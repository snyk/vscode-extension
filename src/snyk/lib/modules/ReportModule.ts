import { constants, reportError } from '@snyk/code-client';
import * as _ from 'lodash';
import { errorType, ReportModuleInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import {
  COMMAND_DEBOUNCE_INTERVAL,
  CONNECTION_ERROR_RETRY_INTERVAL,
  MAX_CONNECTION_RETRIES,
} from '../../constants/general';
import { SNYK_CONTEXT, SNYK_ERROR_CODES } from '../../constants/views';
import { Logger } from '../../logger';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import { ILoadingBadge, LoadingBadge } from '../../view/loadingBadge';
import BaseSnykModule from './BaseSnykModule';

abstract class ReportModule extends BaseSnykModule implements ReportModuleInterface {
  private transientErrors = 0;
  protected loadingBadge: ILoadingBadge;

  constructor() {
    super();
    this.loadingBadge = new LoadingBadge(this.viewManagerService);
  }

  private static get shouldReport(): boolean {
    // DEV: uncomment the following line to test this module in development
    // return true;

    // disabling request sending in dev mode or to self-managed instances.
    return !configuration.isDevelopment;
  }

  resetTransientErrors(): void {
    this.transientErrors = 0;
  }

  private sendError = _.debounce(
    async (options: { [key: string]: any }): Promise<void> => {
      if (!ReportModule.shouldReport || !configuration.shouldReportErrors) return;
      const resp = await reportError({
        baseURL: configuration.baseURL,
        source: configuration.source,
        ...(configuration.token && { sessionToken: configuration.token }),
        ...options,
      });

      if (resp.type === 'error') {
        console.error(resp.error);
      }
    },
    COMMAND_DEBOUNCE_INTERVAL,
    { leading: true, trailing: false },
  );

  async processError(error: errorType, options: { [key: string]: any } = {}): Promise<void> {
    // We don't want to have unhandled rejections around, so if it
    // happens in the error handler we just log it to console.error
    return this.processErrorInternal(error, options).catch(err =>
      Logger.error(`Snyk error handler failed with error: ${err}`),
    );
  }

  private async processErrorInternal(error: errorType, options: { [key: string]: any } = {}): Promise<void> {
    // console.error(`Snyk error handler:`, error);

    const defaultErrorHandler = async () => {
      await this.sendErrorToServer(error, options);
      await this.generalErrorHandler();
    };

    const errorHandlers: { [P in constants.ErrorCodes]: () => Promise<void> } = {
      [constants.ErrorCodes.serverError]: defaultErrorHandler,
      [constants.ErrorCodes.badGateway]: async () => {
        return this.connectionErrorHandler();
      },
      [constants.ErrorCodes.serviceUnavailable]: async () => {
        return this.connectionErrorHandler();
      },
      [constants.ErrorCodes.timeout]: async () => {
        return this.connectionErrorHandler();
      },
      [constants.ErrorCodes.dnsNotFound]: async () => {
        return this.connectionErrorHandler();
      },
      [constants.ErrorCodes.connectionRefused]: async () => {
        return this.connectionErrorHandler();
      },
      [constants.ErrorCodes.loginInProgress]: async () => Promise.resolve(),
      [constants.ErrorCodes.unauthorizedContent]: async () => Promise.resolve(),
      [constants.ErrorCodes.unauthorizedUser]: async () => {
        return this.authenticationErrorHandler();
      },
      [constants.ErrorCodes.unauthorizedBundleAccess]: async () => Promise.resolve(),
      [constants.ErrorCodes.notFound]: async () => Promise.resolve(),
      [constants.ErrorCodes.bigPayload]: async () => Promise.resolve(),
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorStatusCode = error?.statusCode;
    if (errorHandlers.hasOwnProperty(errorStatusCode)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await errorHandlers[errorStatusCode]();
    } else {
      await defaultErrorHandler();
    }
  }

  private async authenticationErrorHandler(): Promise<void> {
    await configuration.setToken('');
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
    this.loadingBadge.setLoadingBadge(true, this);
  }

  private async generalErrorHandler(): Promise<void> {
    this.transientErrors = 0;
    await this.contextService.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.BLOCKING);
    this.loadingBadge.setLoadingBadge(true, this);
  }

  private async connectionErrorHandler(): Promise<void> {
    console.error('Connect error to Snyk service');
    if (this.transientErrors > MAX_CONNECTION_RETRIES) return this.generalErrorHandler();

    this.transientErrors += 1;
    await this.contextService.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.TRANSIENT);
    setTimeout(() => {
      this.startExtension().catch(err =>
        this.processError(err, {
          message: errorsLogs.failedExecutionTransient,
        }),
      );
    }, CONNECTION_ERROR_RETRY_INTERVAL);
    return Promise.resolve();
  }

  private async sendErrorToServer(error: errorType, options: { [key: string]: any }): Promise<void> {
    let type;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      type = `${error.statusCode || ''} ${error.name || ''}`.trim();
    } catch (e) {
      type = 'unknown';
    }
    try {
      await this.sendError({
        type,
        message: options.message || errorsLogs.undefinedError,
        ...(options.endpoint && { path: options.endpoint }),
        ...(options.bundleId && { bundleId: options.bundleId }),
        data: {
          errorTrace: `${error}`,
          ...options.data,
        },
      });
    } catch (e) {
      console.error(errorsLogs.errorReportFail);
      console.error(e);
    }
  }
}

export default ReportModule;
