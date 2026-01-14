import { strictEqual, rejects } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLockService } from '../../../../snyk/common/services/fileLockService';

suite('FileLockService', () => {
  let tempDir: string;
  let lockService: FileLockService;

  setup(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'snyk-lock-test-'));
    lockService = new FileLockService(tempDir);
  });

  teardown(async () => {
    // Clean up temp directory
    try {
      const files = await fs.promises.readdir(tempDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(tempDir, file));
      }
      await fs.promises.rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('acquires and releases lock successfully', async () => {
    let executed = false;

    await lockService.withLock('test-lock', () => {
      executed = true;
      return Promise.resolve();
    });

    strictEqual(executed, true);
  });

  test('lock file is removed after release', async () => {
    await lockService.withLock('test-lock', async () => {
      // Lock should exist during execution
      const lockPath = path.join(tempDir, 'test-lock.lock');
      const exists = await fs.promises
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      strictEqual(exists, true);
    });

    // Lock should be removed after release
    const lockPath = path.join(tempDir, 'test-lock.lock');
    const existsAfter = await fs.promises
      .access(lockPath)
      .then(() => true)
      .catch(() => false);
    strictEqual(existsAfter, false);
  });

  test('returns value from locked function', async () => {
    const result = await lockService.withLock('test-lock', () => {
      return Promise.resolve('test-value');
    });

    strictEqual(result, 'test-value');
  });

  test('releases lock even when function throws', async () => {
    const lockPath = path.join(tempDir, 'test-lock.lock');

    await rejects(
      lockService.withLock('test-lock', () => {
        return Promise.reject(new Error('test error'));
      }),
      /test error/,
    );

    // Lock should be removed even after error
    const existsAfter = await fs.promises
      .access(lockPath)
      .then(() => true)
      .catch(() => false);
    strictEqual(existsAfter, false);
  });

  test('second lock waits for first to release', async () => {
    const order: number[] = [];
    let firstLockAcquired = false;

    const promise1 = lockService.withLock('test-lock', async () => {
      firstLockAcquired = true;
      order.push(1);
      await new Promise(resolve => setTimeout(resolve, 100));
      order.push(2);
    });

    // Wait a bit to ensure first lock is acquired
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify first lock was acquired before starting second
    strictEqual(firstLockAcquired, true);

    // Start second lock attempt after first is holding
    const promise2 = lockService.withLock(
      'test-lock',
      () => {
        order.push(3);
        return Promise.resolve();
      },
      { retryDelay: 20 },
    );

    await Promise.all([promise1, promise2]);

    // Second lock should execute after first completes
    strictEqual(order[0], 1);
    strictEqual(order[1], 2);
    strictEqual(order[2], 3);
  });

  test('detects and removes stale lock', async () => {
    const lockPath = path.join(tempDir, 'test-lock.lock');

    // Create a stale lock file (old timestamp)
    const staleData = JSON.stringify({ pid: 99999, timestamp: Date.now() - 60000 });
    await fs.promises.writeFile(lockPath, staleData);

    let executed = false;
    await lockService.withLock(
      'test-lock',
      () => {
        executed = true;
        return Promise.resolve();
      },
      { staleThreshold: 1000 }, // 1 second threshold
    );

    strictEqual(executed, true);
  });

  test('fails after max retries when lock held', async () => {
    const lockPath = path.join(tempDir, 'test-lock.lock');

    // Create a fresh lock file (not stale)
    const freshData = JSON.stringify({ pid: process.pid, timestamp: Date.now() });
    await fs.promises.writeFile(lockPath, freshData);

    await rejects(
      lockService.withLock(
        'test-lock',
        () => {
          // Should never execute
          return Promise.resolve();
        },
        { retries: 2, retryDelay: 10, staleThreshold: 60000 },
      ),
      /Failed to acquire lock after 2 attempts/,
    );
  });

  test('creates lock directory if it does not exist', async () => {
    const nestedDir = path.join(tempDir, 'nested', 'dir');
    const nestedLockService = new FileLockService(nestedDir);

    let executed = false;
    await nestedLockService.withLock('test-lock', () => {
      executed = true;
      return Promise.resolve();
    });

    strictEqual(executed, true);
  });
});
