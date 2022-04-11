import { ILoadingBadge } from '../../base/views/loadingBadge';
import { SNYK_CONTEXT, SNYK_ERROR_CODES } from '../constants/views';
import { ILog } from '../logger/interfaces';
import { IContextService } from '../services/contextService';
import { ErrorReporter, Tags } from './errorReporter';

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
    await contextService.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.BLOCKING);
    loadingBadge.setLoadingBadge(true);
    ErrorHandler.handle(error, logger);
  }

  /**
   * Should be used to log locally and report error event remotely.
   */
  static handle(error: Error | unknown, logger: ILog, message?: string, tags?: Tags): void {
    const errorStr = ErrorHandler.stringifyError(error);
    logger.error(message ? `${message}. ${errorStr}` : errorStr);
    ErrorReporter.capture(error, tags);
  }

  static stringifyError(error: Error | unknown): string {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  }
}
