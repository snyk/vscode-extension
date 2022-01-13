import { ILoadingBadge } from '../../base/views/loadingBadge';
import { SNYK_CONTEXT, SNYK_ERROR_CODES } from '../constants/views';
import { ILog } from '../logger/interfaces';
import { IContextService } from '../services/contextService';
import { ErrorReporter } from './errorReporter';

/**
 * General error handler.
 */
export class ErrorHandler {
  /**
   * Should be used only if the affected error breaks the whole extension.
   */
  static async handleGlobal(
    error: Error,
    logger: ILog,
    contextService: IContextService,
    loadingBadge: ILoadingBadge,
  ): Promise<void> {
    await contextService.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.BLOCKING);
    loadingBadge.setLoadingBadge(true);

    this.handle(error, logger);
  }

  /**
   * Should be used to log locally and report error event remotely.
   */
  static handle(error: Error, logger: ILog, message?: string): void {
    logger.error(message ? `${message} ${error}` : error.toString());
    ErrorReporter.capture(error);
  }
}
