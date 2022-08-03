import { constants } from '@snyk/code-client';
import { errorType, IBaseSnykModule } from '../../base/modules/interfaces';
import { ILoadingBadge } from '../../base/views/loadingBadge';
import { IConfiguration } from '../../common/configuration/configuration';
import { CONNECTION_ERROR_RETRY_INTERVAL, MAX_CONNECTION_RETRIES } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ErrorHandler } from '../../common/error/errorHandler';
import { TagKeys, Tags } from '../../common/error/errorReporter';
import { ILog } from '../../common/logger/interfaces';
import { IContextService } from '../../common/services/contextService';

type SnykCodeErrorResponseType = {
  apiName: string;
  errorCode: string;
  messages: { [key: number]: unknown };
};

class SnykCodeErrorResponse {
  constructor(public error: SnykCodeErrorResponseType) {}
}

export interface ISnykCodeErrorHandler {
  resetTransientErrors(): void;
  get connectionRetryLimitExhausted(): boolean;
  processError(
    error: errorType,
    options?: { [key: string]: unknown },
    requestId?: string,
    callback?: (error: Error) => void,
  ): Promise<void>;
}

export class SnykCodeErrorHandler extends ErrorHandler implements ISnykCodeErrorHandler {
  private transientErrors = 0;
  private _requestId: string | undefined;
  private _connectionRetryLimitExhausted = false;

  constructor(
    private contextService: IContextService,
    private loadingBadge: ILoadingBadge,
    private readonly logger: ILog,
    private readonly baseSnykModule: IBaseSnykModule,
    private readonly configuration: IConfiguration,
  ) {
    super();
  }

  resetTransientErrors(): void {
    this.transientErrors = 0;
  }

  resetRequestId(): void {
    this._requestId = undefined;
  }

  get connectionRetryLimitExhausted(): boolean {
    return this._connectionRetryLimitExhausted;
  }

  private isAuthenticationError(errorStatusCode: PropertyKey): boolean {
    return errorStatusCode === constants.ErrorCodes.unauthorizedUser;
  }

  private isBundleError(error: errorType): boolean {
    // checkBundle API call returns 404 sometimes that gets propagated as an Error to us from 'code-client', treat as a transient error [ROAD-683]
    return error instanceof Error && error.message === 'Failed to get remote bundle';
  }

  private async authenticationErrorHandler(): Promise<void> {
    await this.configuration.setToken('');
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
    this.loadingBadge.setLoadingBadge(true);
  }

  static isErrorRetryable(errorStatusCode: PropertyKey): boolean {
    switch (errorStatusCode) {
      case constants.ErrorCodes.badGateway:
      case constants.ErrorCodes.serviceUnavailable:
      case constants.ErrorCodes.serverError:
      case constants.ErrorCodes.timeout:
      case constants.ErrorCodes.dnsNotFound:
      case constants.ErrorCodes.connectionRefused:
      case constants.ErrorCodes.notFound:
        return true;

      default:
        return false;
    }
  }

  private extractErrorResponse(error: errorType) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!(error instanceof Error) && error?.apiName) {
      // Error can come in different shapes, see https://github.com/snyk/code-client/blob/b5eb140e1400049caf8cbb133a951ab007b031d0/src/http.ts#L43. Extract all.
      const { apiName, statusCode, statusText, errorCode, messages } = error as { [key: string]: string };
      if (errorCode) {
        return new SnykCodeErrorResponse({ apiName, errorCode, messages });
      }

      return new SnykCodeErrorResponse({ apiName, errorCode: statusCode, messages: statusText });
    }
  }

  async processError(
    error: errorType,
    options: { [key: string]: unknown } = {},
    requestId: string,
    callback: (error: Error) => void,
  ): Promise<void> {
    // We don't want to have unhandled rejections around, so if it
    // happens in the error handler we just log it

    this._requestId = requestId;
    const errorResponse = this.extractErrorResponse(error);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updatedError = errorResponse ? errorResponse : error;

    return this.processErrorInternal(updatedError, options, callback).catch(err =>
      ErrorHandler.handle(err, this.logger, 'Snyk Code error handler failed with error.', {
        [TagKeys.CodeRequestId]: this._requestId,
      }),
    );
  }

  private async processErrorInternal(
    error: errorType,
    options: { [key: string]: unknown } = {},
    callback: (error: Error) => void,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorStatusCode = (error?.statusCode as PropertyKey) || (error?.error?.errorCode as PropertyKey);

    if (this.isAuthenticationError(errorStatusCode)) {
      return await this.authenticationErrorHandler();
    }

    if (SnykCodeErrorHandler.isErrorRetryable(errorStatusCode) || this.isBundleError(error)) {
      return await this.retryHandler(error, errorStatusCode, options, callback);
    }

    this._connectionRetryLimitExhausted = true;
    this.generalErrorHandler(error, options, callback);

    return Promise.resolve();
  }

  private generalErrorHandler(
    error: errorType,
    options: { [key: string]: unknown },
    callback: (error: errorType) => void,
  ): void {
    this.transientErrors = 0;
    callback(error);

    this.capture(error, options, { [TagKeys.CodeRequestId]: this._requestId });
    this.resetRequestId();
  }

  private async retryHandler(
    error: errorType,
    errorStatusCode: PropertyKey,
    options: { [key: string]: unknown },
    callback: (error: Error) => void,
  ): Promise<void> {
    this.logger.error(`Connection error to Snyk Code. Try count: ${this.transientErrors + 1}.`);

    if (this.transientErrors > MAX_CONNECTION_RETRIES) {
      this._connectionRetryLimitExhausted = true;
      this.generalErrorHandler(error, options, callback);
      return;
    }

    this.transientErrors += 1;

    if (errorStatusCode === constants.ErrorCodes.notFound) {
      this.baseSnykModule.snykCode.clearBundle(); // bundle has expired, trigger complete new analysis
    }

    setTimeout(() => {
      this.baseSnykModule.runCodeScan().catch(err => this.capture(err, options));
    }, CONNECTION_ERROR_RETRY_INTERVAL);

    return Promise.resolve();
  }

  capture(error: errorType, options: { [key: string]: unknown }, tags?: Tags): void {
    if (error instanceof SnykCodeErrorResponse) {
      error = new Error(JSON.stringify(error?.error));
    }

    let msg = error instanceof Error ? error?.message : '';
    if (Object.keys(options).length > 0) {
      msg += `. ${JSON.stringify(options)}`;
    }

    ErrorHandler.handle(error, this.logger, msg, tags);
  }
}
