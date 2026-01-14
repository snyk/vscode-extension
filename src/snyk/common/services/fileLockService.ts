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

  private async acquireLock(lockPath: string, options?: LockOptions): Promise<void> {
    const maxRetries = options?.retries ?? 10;
    const baseDelay = options?.retryDelay ?? 50;
    const staleThreshold = options?.staleThreshold ?? 30000;

    // Ensure directory exists
    await this.ensureDirectory(path.dirname(lockPath));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // O_CREAT | O_EXCL = atomic create-if-not-exists
        const fd = await fs.promises.open(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
        // Write PID and timestamp for stale detection
        const lockContent: LockFileContent = { pid: process.pid, timestamp: Date.now() };
        await fd.write(JSON.stringify(lockContent));
        await fd.close();
        return; // Lock acquired
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'EEXIST') {
          // Lock file exists - check if stale
          if (await this.isLockStale(lockPath, staleThreshold)) {
            await this.safeUnlink(lockPath);
            continue; // Retry immediately after removing stale lock
          }
          // Wait with exponential backoff (capped)
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 1000);
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed to acquire lock after ${maxRetries} attempts`);
  }

  private async isLockStale(lockPath: string, threshold: number): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(lockPath, 'utf-8');
      const lockData = JSON.parse(content) as LockFileContent;
      return Date.now() - lockData.timestamp > threshold;
    } catch {
      // If we can't read it (corrupted, empty, etc.), treat as stale
      return true;
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
