import * as fs from 'fs';
import * as path from 'path';

export interface LockOptions {
  /** Max retry attempts (default: 10) */
  retries?: number;
  /** Base delay between retries in ms (default: 50) */
  retryDelay?: number;
  /** Lock file age in ms to consider stale (default: 30000) */
  staleThreshold?: number;
}

export interface IFileLockService {
  withLock<T>(lockName: string, fn: () => Promise<T>, options?: LockOptions): Promise<T>;
}

interface LockFileContent {
  pid: number;
  timestamp: number;
}

/**
 * A cross-process file-based locking service using atomic file operations.
 * Uses Node.js fs.open() with O_CREAT | O_EXCL flags for atomic lock acquisition.
 */
export class FileLockService implements IFileLockService {
  constructor(private readonly globalStoragePath: string) {}

  /**
   * Executes a function while holding an exclusive lock.
   * @param lockName - Name of the lock (used as filename)
   * @param fn - Function to execute while holding the lock
   * @param options - Lock acquisition options
   * @returns The return value of the function
   */
  async withLock<T>(lockName: string, fn: () => Promise<T>, options?: LockOptions): Promise<T> {
    const lockPath = path.join(this.globalStoragePath, `${lockName}.lock`);

    await this.acquireLock(lockPath, options);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lockPath);
    }
  }

  // eslint-disable-next-line no-await-in-loop -- Intentional: retry loop requires sequential await for lock acquisition
  private async acquireLock(lockPath: string, options?: LockOptions): Promise<void> {
    const maxRetries = options?.retries ?? 10;
    const baseDelay = options?.retryDelay ?? 50;
    const staleThreshold = options?.staleThreshold ?? 30000;

    // Ensure directory exists
    await this.ensureDirectory(path.dirname(lockPath));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // O_CREAT | O_EXCL = atomic create-if-not-exists
        // eslint-disable-next-line no-await-in-loop
        const fd = await fs.promises.open(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
        // Write PID and timestamp for stale detection
        const lockContent: LockFileContent = { pid: process.pid, timestamp: Date.now() };
        // eslint-disable-next-line no-await-in-loop
        await fd.write(JSON.stringify(lockContent));
        // eslint-disable-next-line no-await-in-loop
        await fd.close();
        return; // Lock acquired
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'EEXIST') {
          // Lock file exists - check if stale
          // eslint-disable-next-line no-await-in-loop
          if (await this.isLockStale(lockPath, staleThreshold)) {
            // eslint-disable-next-line no-await-in-loop
            await this.safeUnlink(lockPath);
            continue; // Retry immediately after removing stale lock
          }
          // Wait with exponential backoff (capped)
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 1000);
          // eslint-disable-next-line no-await-in-loop
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed to acquire lock after ${maxRetries} attempts`);
  }

  private async isLockStale(lockPath: string, threshold: number): Promise<boolean> {
    // Wait for valid JSON content or until mtime is older than threshold
    // This prevents race conditions where we read while another process is still writing
    const maxContentRetries = 5;
    const contentRetryDelay = 50; // ms

    for (let attempt = 0; attempt < maxContentRetries; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const content = await fs.promises.readFile(lockPath, 'utf-8');

        // Try to parse JSON content
        if (content && content.trim().length > 0) {
          try {
            const lockData = JSON.parse(content) as LockFileContent;
            if (typeof lockData.timestamp === 'number') {
              // Valid JSON with timestamp - check if stale
              return Date.now() - lockData.timestamp > threshold;
            }
          } catch {
            // JSON parse failed - content might still be written, continue waiting
          }
        }

        // Content is empty or invalid JSON - check if mtime is old enough to consider stale
        // eslint-disable-next-line no-await-in-loop
        const mtimeStale = await this.isFileModificationTimeStale(lockPath, threshold);
        if (mtimeStale) {
          // File is old enough with invalid content - definitely stale/orphaned
          return true;
        }

        // mtime is recent, content might still be written - wait and retry
        if (attempt < maxContentRetries - 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(r => setTimeout(r, contentRetryDelay));
        }
      } catch {
        // Can't read file - check mtime as fallback
        // eslint-disable-next-line no-await-in-loop
        return this.isFileModificationTimeStale(lockPath, threshold);
      }
    }

    // After all retries, if we still can't get valid JSON but mtime is recent,
    // assume the lock is valid (not stale) to be safe
    return false;
  }

  private async isFileModificationTimeStale(lockPath: string, threshold: number): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(lockPath);
      const mtime = stats.mtimeMs;
      return Date.now() - mtime > threshold;
    } catch {
      // If we can't stat the file, assume it's not stale (file might have been deleted)
      return false;
    }
  }

  private async releaseLock(lockPath: string): Promise<void> {
    await this.safeUnlink(lockPath);
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Ignore errors (file may already be deleted)
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch {
      // Ignore errors (directory may already exist)
    }
  }
}
