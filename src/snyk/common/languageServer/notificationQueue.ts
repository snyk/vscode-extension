// ABOUTME: Queue implementation for sequential processing of async notification handlers
// ABOUTME: Handles async operations from language server notifications to prevent race conditions

import { ILog } from '../logger/interfaces';

export interface QueueItem<T> {
  id: string;
  type: string;
  data: T;
  processor: () => Promise<void>;
  retries?: number;
  priority?: number;
}

export class NotificationQueue {
  private queue: QueueItem<unknown>[] = [];
  private processingChain: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(private readonly logger: ILog) {}

  /**
   * Enqueues an item for processing. Items are processed sequentially in FIFO order.
   * Uses a promise chain to ensure sequential processing without explicit locks or void.
   */
  enqueue<T>(item: QueueItem<T>): void {
    if (this.stopped) {
      this.logger.debug(`Queue is stopped, not enqueuing item ${item.id}`);
      return;
    }

    this.queue.push(item);
    this.logger.debug(`Enqueued item ${item.id} (type: ${item.type}), queue size: ${this.queue.length}`);

    // Chain the next processing operation to the existing chain
    // This ensures items are processed sequentially without race conditions
    this.processingChain = this.processingChain
      .then(() => this.processNext())
      .catch(() => {
        // Errors are already logged in processItem, this catch prevents unhandled rejection
      });
  }

  /**
   * Processes the next item in the queue if available.
   */
  private async processNext(): Promise<void> {
    if (this.stopped || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) {
      return;
    }

    await this.processItem(item);
  }

  /**
   * Processes a single queue item and handles errors.
   */
  private async processItem(item: QueueItem<unknown>): Promise<void> {
    try {
      this.logger.debug(`Processing item ${item.id} (type: ${item.type})`);
      await item.processor();
      this.logger.debug(`Completed item ${item.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing queue item ${item.id}: ${errorMessage}`);
      // Continue processing other items even if this one fails
    }
  }

  /**
   * Stops the queue. Waits for all pending items to finish processing,
   * then prevents new items from being enqueued.
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping notification queue...');
    this.stopped = true;

    // Wait for the current processing chain to complete
    await this.processingChain;

    // Process any remaining items that were already queued
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        // eslint-disable-next-line no-await-in-loop
        await this.processItem(item);
      }
    }

    this.logger.info('Notification queue stopped');
  }
}
