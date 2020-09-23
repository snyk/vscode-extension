import { ReportModuleInterface, errorType } from "../../../interfaces/DeepCodeInterfaces";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";
import { DEEPCODE_CONTEXT, DEEPCODE_ERROR_CODES } from "../../constants/views";
import { MAX_CONNECTION_RETRIES, CONNECTION_ERROR_RETRY_INTERVAL } from "../../constants/general";

import { reportEvent, reportError } from '@deepcode/tsc';

abstract class ReportModule extends BaseDeepCodeModule implements ReportModuleInterface {
  private transientErrors = 0;

  private get shouldReport(): boolean {
    // DEV: uncomment the following line to test this module in development
    // return true;

    // disabling request sending in dev mode or to self-managed instances.
    return this.baseURL === this.defaultBaseURL;
  }

  resetTransientErrors(): void {
    this.transientErrors = 0;
  }

  private async sendEvent(event: string, options: {[key: string]: any}): Promise<void> {
    if (!this.shouldReport || !this.shouldReportEvents) return;
    try {
      await reportEvent({
        baseURL: this.baseURL,
        type: event,
        source: this.source,
        ...(this.token && { sessionToken: this.token }),
        ...options,
      });
    } catch(error) {
      await this.processError(error, {
        message: errorsLogs.sendEvent,
        data: {
          event,
          source: this.source,
          ...(this.token && { sessionToken: this.token }),
          ...options
        },
      });
    }
  }

  async processEvent(
    event: string,
    options: { [key: string]: any } = {}
  ): Promise<void> {
    // processEvent must be safely callable without waiting its completition.
    return this.sendEvent(event, options).catch((err) =>
      console.error("DeepCode event handler failed with error:", err)
    );
  }

  async trackViewSuggestion(issueId: string, severity: number): Promise<void> {
    issueId = decodeURIComponent(issueId);
    const [ language, model ] = issueId.split('/');
    return this.processEvent(TELEMETRY_EVENTS.viewSuggestion, {
      data: { issueId, severity, language, model }
    });
  }

  private async sendError(options: {[key: string]: any}): Promise<void> {
    if (!this.shouldReport || !this.shouldReportErrors) return;
    const resp = await reportError({
      baseURL: this.baseURL,
      source: this.source,
      ...(this.token && { sessionToken: this.token }),
      ...options,
    });

    if (resp.type === 'error') {
      console.error(resp.error);
    }
  }

  async processError(
    error: errorType,
    options: { [key: string]: any } = {}
  ): Promise<void> {
    // We don't want to have unhandled rejections around, so if it
    // happens in the error handler we just log it to console.error
    return this.processErrorInternal(error, options).catch(error =>
      console.error(`DeepCode error handler failed with error: ${error}`)
    );
  }

  private async processErrorInternal(
    error: errorType,
    options: { [key: string]: any } = {}
  ): Promise<void> {
    console.error(`DeepCode error handler: ${JSON.stringify(error)}`);

    if (error.error) {
      const { code, message } = error.error;
      // TODO: move it to 'tsc'
      if (code === "ENOTFOUND" && message === 'getaddrinfo ENOTFOUND www.deepcode.ai') {
        return this.connectionErrorHandler();
      }
    }

    if (error.errno) {
      if (error.errno === "ECONNREFUSED") return this.connectionErrorHandler();
      await this.sendErrorToServer(error, options);
      return this.generalErrorHandler();
    }

    const {
      unauthorizedUser,
      unauthorizedContent,
      unauthorizedBundleAccess,
      notFound,
      serverError,
      badGateway,
      serviceUnavailable,
      timeout
    } = statusCodes;

    switch (error.statusCode) {
      case serverError:
      case badGateway:
      case serviceUnavailable:
      case timeout:
        return this.connectionErrorHandler();
      case unauthorizedContent:
      case unauthorizedBundleAccess:
      case unauthorizedUser:
      case notFound:
      default:
        await this.sendErrorToServer(error, options);
        return this.generalErrorHandler();
    }
  }

  private async generalErrorHandler(): Promise<void> {
    this.transientErrors = 0;
    await this.setContext(DEEPCODE_CONTEXT.ERROR, DEEPCODE_ERROR_CODES.BLOCKING);
    await this.setLoadingBadge(true);
  }

  private async connectionErrorHandler(): Promise<void> {
    if (this.transientErrors > MAX_CONNECTION_RETRIES) return this.generalErrorHandler();

    ++this.transientErrors;
    await this.setContext(DEEPCODE_CONTEXT.ERROR, DEEPCODE_ERROR_CODES.TRANSIENT);
    setTimeout(() => {
      this.startExtension().catch((err) => this.processError(err, {
        message: errorsLogs.failedExecutionTransient,
      }));
    }, CONNECTION_ERROR_RETRY_INTERVAL);
  }

  private async sendErrorToServer(
    error: errorType,
    options: { [key: string]: any }
  ): Promise<void> {
    let errorTrace;
    let type;
    try {
      errorTrace = JSON.stringify(error);
    } catch (e) {
      errorTrace = error;
    }
    try {
      type = `${error.statusCode || ""} ${error.name || ""}`.trim();
    } catch (e) {
      type = "unknown";
    }
    try {
      await this.sendError({
        type,
        message: options.message || errorsLogs.undefinedError,
        ...(options.endpoint && { path: options.endpoint }),
        ...(options.bundleId && { bundleId: options.bundleId }),
        data: {
          errorTrace,
          ...options.data
        }
      });
    } catch (e) {
      console.error(errorsLogs.errorReportFail);
      console.error(e);
    }
  }
}

export default ReportModule;
