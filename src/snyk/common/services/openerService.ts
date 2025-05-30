import open from 'open';
import { ErrorHandler } from '../error/errorHandler';
import { Logger } from '../logger/logger';

export interface IOpenerService {
  openBrowserUrl(url: string): Promise<void>;
}

export class OpenerService {
  async openBrowserUrl(url: string): Promise<void> {
    try {
      await open(url);
    } catch (err) {
      ErrorHandler.handle(err, Logger);
    }
  }
}
