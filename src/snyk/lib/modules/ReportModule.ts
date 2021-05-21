import * as _ from "lodash";
import { COMMAND_DEBOUNCE_INTERVAL } from "../../constants/general";
import { ReportModuleInterface, errorType } from "../../../interfaces/SnykInterfaces";
import BaseSnykModule from './BaseSnykModule';
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";
import { SNYK_CONTEXT, SNYK_ERROR_CODES } from "../../constants/views";
import { MAX_CONNECTION_RETRIES, CONNECTION_ERROR_RETRY_INTERVAL } from "../../constants/general";

import { reportEvent, reportError, constants } from '@snyk/code-client';
import { configuration } from "../../configuration";

abstract class ReportModule extends BaseSnykModule implements ReportModuleInterface {
  private transientErrors = 0;

  private get shouldReport(): boolean {
    // DEV: uncomment the following line to test this module in development
    // return true;

    // disabling request sending in dev mode or to self-managed instances.
    return configuration.baseURL === configuration.defaultBaseURL || true;
  }

  resetTransientErrors(): void {
    this.transientErrors = 0;
  }

  private sendEvent = _.debounce(
    async (event: string, options: { [key: string]: any }): Promise<void> => {
      if (!this.shouldReport || !configuration.shouldReportEvents) return;
      try {
        await reportEvent({
          baseURL: configuration.baseURL,
          type: event,
          source: configuration.source,
          ...(configuration.token && { sessionToken: configuration.token }),
          ...options,
        });
      } catch (error) {
        await this.processError(error, {
          message: errorsLogs.sendEvent,
          data: {
            event,
            source: configuration.source,
            ...(configuration.token && { sessionToken: configuration.token }),
            ...options,
          },
        });
      }
    },
    COMMAND_DEBOUNCE_INTERVAL,
    { leading: true, trailing: false },
  );

  async processEvent(event: string, options: { [key: string]: any } = {}): Promise<void> {
    // processEvent must be safely callable without waiting its completition.
    try{
      await this.sendEvent(event, options);
    } catch(err) {
      console.error('Snyk event handler failed with error:', err);
    }
  }

  async trackViewSuggestion(issueId: string, severity: number): Promise<void> {
    issueId = decodeURIComponent(issueId);
    const [language, model] = issueId.split('/');
    return this.processEvent(TELEMETRY_EVENTS.viewSuggestion, {
      data: { issueId, severity, language, model },
    });
  }

  private sendError = _.debounce(
    async (options: { [key: string]: any }): Promise<void> => {
      if (!this.shouldReport || !configuration.shouldReportErrors) return;
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
    return this.processErrorInternal(error, options).catch(error =>
      console.error(`Snyk error handler failed with error: ${error}`),
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
      [constants.ErrorCodes.loginInProgress]: async () => {},
      [constants.ErrorCodes.unauthorizedContent]: async () => {},
      [constants.ErrorCodes.unauthorizedUser]: async () => {
        return this.authenticationErrorHandler();
      },
      [constants.ErrorCodes.unauthorizedBundleAccess]: async () => {},
      [constants.ErrorCodes.notFound]: async () => {},
      [constants.ErrorCodes.bigPayload]: async () => {},
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errorStatusCode = error.statusCode;
    if (errorHandlers.hasOwnProperty(errorStatusCode)) {
      await errorHandlers[errorStatusCode]();
    } else {
      await defaultErrorHandler();
    }
  }

  private async authenticationErrorHandler(): Promise<void> {
    await configuration.setToken('');
    await this.setContext(SNYK_CONTEXT.LOGGEDIN, false);
    await this.setLoadingBadge(true);
  }

  private async generalErrorHandler(): Promise<void> {
    this.transientErrors = 0;
    await this.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.BLOCKING);
    await this.setLoadingBadge(true);
  }

  private async connectionErrorHandler(): Promise<void> {
    console.error('Connect error to Snyk service');
    if (this.transientErrors > MAX_CONNECTION_RETRIES) return this.generalErrorHandler();

    ++this.transientErrors;
    await this.setContext(SNYK_CONTEXT.ERROR, SNYK_ERROR_CODES.TRANSIENT);
    setTimeout(() => {
      this.startExtension().catch(err =>
        this.processError(err, {
          message: errorsLogs.failedExecutionTransient,
        }),
      );
    }, CONNECTION_ERROR_RETRY_INTERVAL);
  }

  private async sendErrorToServer(error: errorType, options: { [key: string]: any }): Promise<void> {
    let type;
    try {
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
