import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT, DEEPCODE_ERROR_CODES } from "../../constants/views";
import { MAX_CONNECTION_RETRIES } from "../../constants/general";

abstract class ReportModule extends BaseDeepCodeModule implements DeepCode.ReportModuleInterface {
  private transientErrors = 0;
  
  private get shouldReport(): boolean {
    // DEV: uncomment the following line to test this module in development
    // return true;

    // disabling request sending in dev mode or to self-managed instances.
    return this.baseURL === this.defaultBaseURL;
  }

  public resetTransientErrors(): void {
    this.transientErrors = 0;
  }

  public async sendError(options: {[key: string]: any}): Promise<void> {
    if (!this.shouldReport || !this.shouldReportErrors) return;
    await http.sendError(this.baseURL, {
      source: this.source,
      ...(this.token && { sessionToken: this.token }),
      ...options
    });
  }

  public async sendEvent(event: string, options: {[key: string]: any}): Promise<void> {
    if (!this.shouldReport || !this.shouldReportEvents) return;
    await http.sendEvent(this.baseURL, {
      type: event,
      source: this.source,
      ...(this.token && { sessionToken: this.token }),
      ...options
    });
  }

  public async processError(
    error: DeepCode.errorType,
    options: { [key: string]: any } = {}
  ): Promise<void> {
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

    console.error("DeepCode error handler:", error);

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

    switch (error.statusCode) {
      case unauthorizedContent:
      case unauthorizedBundleAccess:
      case serverError:
      case badGateway:
      case serviceUnavailable:
      case timeout:
        return this.connectionErrorHandler();
      case unauthorizedUser:
      case notFound:
      default:
        await this.sendErrorToServer(error, options);
        return this.generalErrorHandler();
    }
  }

  private generalErrorHandler(): void {
    this.transientErrors = 0;
    setContext(DEEPCODE_CONTEXT.ERROR, DEEPCODE_ERROR_CODES.BLOCKING);
  }

  private connectionErrorHandler(): void {
    if (this.transientErrors > MAX_CONNECTION_RETRIES) return this.generalErrorHandler();
    
    ++this.transientErrors;
    setContext(DEEPCODE_CONTEXT.ERROR, DEEPCODE_ERROR_CODES.TRANSIENT);
    setTimeout(async () => {
      this.startExtension();
    }, 5000);
  }

  private async sendErrorToServer(
    error: DeepCode.errorType,
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
      type = "unknown"
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
      console.error(e);
    }
  }
}

export default ReportModule;
