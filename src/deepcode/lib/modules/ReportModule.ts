import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import BaseDeepCodeModule from "./BaseDeepCodeModule";

class ReportModule extends BaseDeepCodeModule implements DeepCode.ReportModuleInterface {
  private get shouldReport(): boolean {
    // DEV: uncomment the following line to test this module in development
    // return true;

    // disabling request sending in dev mode or to self-managed instances.
    return process.env.NODE_ENV === "production" && this.baseURL === this.defaultBaseURL;
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
}

export default ReportModule;
