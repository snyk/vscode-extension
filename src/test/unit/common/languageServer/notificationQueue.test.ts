// ABOUTME: Tests for NotificationQueue class that handles async notification processing
// ABOUTME: Ensures sequential processing, proper error handling, and graceful shutdown
/* eslint-disable @typescript-eslint/require-await */
import assert from 'assert';
import sinon from 'sinon';
import { NotificationQueue } from '../../../../snyk/common/languageServer/notificationQueue';
import { LoggerMock } from '../../mocks/logger.mock';

suite('NotificationQueue', () => {
  let queue: NotificationQueue;
  let logger: LoggerMock;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    logger = new LoggerMock();
    queue = new NotificationQueue(logger);
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    clock.restore();
    sinon.restore();
  });

  test('should process items sequentially', async () => {
    const executionOrder: number[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Item 1 takes 100ms
    queue.enqueue({
      id: 'item-1',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
        await delay(100);
        executionOrder.push(11);
      },
    });

    // Item 2 takes 50ms
    queue.enqueue({
      id: 'item-2',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(2);
        await delay(50);
        executionOrder.push(22);
      },
    });

    // Advance time to allow processing
    await clock.tickAsync(100);
    await clock.tickAsync(50);

    // Item 1 should complete before item 2 starts
    assert.deepStrictEqual(executionOrder, [1, 11, 2, 22]);
  });

  test('should handle errors without stopping queue', async () => {
    const executionOrder: number[] = [];

    // Item 1 succeeds
    queue.enqueue({
      id: 'item-1',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
      },
    });

    // Item 2 throws error
    queue.enqueue({
      id: 'item-2',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(2);
        throw new Error('Test error');
      },
    });

    // Item 3 should still execute
    queue.enqueue({
      id: 'item-3',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(3);
      },
    });

    await clock.runAllAsync();

    // All items should have executed
    assert.deepStrictEqual(executionOrder, [1, 2, 3]);
  });

  test('should log errors when processing fails', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    const testError = new Error('Processing failed');

    queue.enqueue({
      id: 'failing-item',
      type: 'test',
      data: {},
      processor: async () => {
        throw testError;
      },
    });

    await clock.runAllAsync();

    assert.strictEqual(errorSpy.callCount, 1);
    const errorCall = errorSpy.getCall(0);
    assert.ok(errorCall.args[0].includes('failing-item'));
    assert.ok(errorCall.args[0].includes('Processing failed'));
  });

  test('should process multiple items in order', async () => {
    const executionOrder: number[] = [];

    for (let i = 1; i <= 5; i++) {
      queue.enqueue({
        id: `item-${i}`,
        type: 'test',
        data: {},
        processor: async () => {
          executionOrder.push(i);
        },
      });
    }

    await clock.runAllAsync();

    assert.deepStrictEqual(executionOrder, [1, 2, 3, 4, 5]);
  });

  test('should stop processing new items after stop() is called', async () => {
    const executionOrder: number[] = [];

    queue.enqueue({
      id: 'item-1',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
      },
    });

    queue.enqueue({
      id: 'item-2',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(2);
      },
    });

    // Process first item
    await clock.tickAsync(10);

    // Stop the queue
    await queue.stop();

    // Try to add more items - they shouldn't be processed
    queue.enqueue({
      id: 'item-3',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(3);
      },
    });

    await clock.runAllAsync();

    // Only items 1 and 2 should have executed (item 2 was queued before stop)
    assert.deepStrictEqual(executionOrder, [1, 2]);
  });

  test('should wait for current item to finish when stopping', async () => {
    const executionOrder: number[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    queue.enqueue({
      id: 'long-running',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
        await delay(100);
        executionOrder.push(2);
      },
    });

    // Start processing
    await clock.tickAsync(10);

    // Stop should wait for current item to finish
    const stopPromise = queue.stop();
    await clock.tickAsync(100);
    await stopPromise;

    assert.deepStrictEqual(executionOrder, [1, 2]);
  });

  test('should handle enqueue after stop gracefully', async () => {
    await queue.stop();

    const executionOrder: number[] = [];

    queue.enqueue({
      id: 'item-after-stop',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
      },
    });

    await clock.runAllAsync();

    // Item should not be processed
    assert.deepStrictEqual(executionOrder, []);
  });

  test('should process items immediately if queue is empty', async () => {
    const executionOrder: number[] = [];

    queue.enqueue({
      id: 'item-1',
      type: 'test',
      data: {},
      processor: async () => {
        executionOrder.push(1);
      },
    });

    await clock.tickAsync(10);

    // Item should have started processing
    assert.deepStrictEqual(executionOrder, [1]);
  });

  test('should handle concurrent enqueues correctly', async () => {
    const executionOrder: number[] = [];

    // Enqueue multiple items at once
    const promises = [];
    for (let i = 1; i <= 3; i++) {
      promises.push(
        queue.enqueue({
          id: `item-${i}`,
          type: 'test',
          data: {},
          processor: async () => {
            executionOrder.push(i);
          },
        }),
      );
    }

    await Promise.all(promises);
    await clock.runAllAsync();

    assert.deepStrictEqual(executionOrder, [1, 2, 3]);
  });

  test('should preserve data in queue items', async () => {
    const testData = { value: 'test-data', count: 42 };
    let capturedData: { value: string; count: number } | undefined;

    queue.enqueue({
      id: 'data-test',
      type: 'test',
      data: testData,
      processor: async () => {
        capturedData = testData;
      },
    });

    await clock.runAllAsync();

    assert.deepStrictEqual(capturedData, testData);
  });
});
