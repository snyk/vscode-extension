import { ILoadingBadge } from '../../base/views/loadingBadge';
import { SNYK_CONTEXT } from '../constants/views';
import { ILog } from '../logger/interfaces';
import { IContextService } from '../services/contextService';

/**
 * General error handler.
 */
export class ErrorHandler {
  /**
   * Should be used only if the affected error breaks the whole extension.
   */
  static async handleGlobal(
    error: Error | unknown,
    logger: ILog,
    contextService: IContextService,
    loadingBadge: ILoadingBadge,
  ): Promise<void> {
    await contextService.setContext(SNYK_CONTEXT.ERROR, error);
    loadingBadge.setLoadingBadge(true);
    ErrorHandler.handle(error, logger);
  }

  /**
   * Should be used to log locally and report error event remotely.
   */
  static handle(error: Error | unknown, logger: ILog, message?: string): void {
    const errorStr = ErrorHandler.stringifyError(error);
    logger.error(message ? `${message}. ${errorStr}` : errorStr);
  }

  static stringifyError(error: Error | unknown): string {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  }
}
