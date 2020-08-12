import ReportModule from "./ReportModule";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { setContext, viewInBrowser } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT } from "../../constants/views";


const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

abstract class LoginModule extends ReportModule implements DeepCode.LoginModuleInterface {
  private pendingLogin: boolean = false;

  public async initiateLogin(): Promise<void> {
    if (this.pendingLogin) {
      return;
    }

    this.pendingLogin = true;
    try {
      setContext(DEEPCODE_CONTEXT.LOGGEDIN, false);
      const result = await http.login(this.baseURL, this.source);
      let { sessionToken, loginURL } = result;
      if (!sessionToken || !loginURL) {
        throw new Error(`Failed to create a new session with response: ${JSON.stringify(result)}`);
      }
      await this.setToken(sessionToken);
      await viewInBrowser(loginURL);
      await this.waitLoginConfirmation();
    } catch (err) {
      await this.processError(err);
    } finally {
      this.pendingLogin = false;
    }
  }

  public async checkSession(): Promise<boolean> {
    let validSession = false;
    if (this.token) {
      validSession = !!(await http.checkSession(this.baseURL, this.token));
    }
    setContext(DEEPCODE_CONTEXT.LOGGEDIN, validSession);
    return validSession;
  }

  private async waitLoginConfirmation(): Promise<void> {
    if (!this.token) return;
    // 20 attempts to wait for user's login & consent
    for (let i = 0; i < 20; i++) {
      await sleep(1000);

      const confirmed = await this.checkSession();
      if (confirmed) {
        return;
      }
    }
  }

  public async checkApproval(): Promise<boolean> {
    let approved = this.uploadApproved;
    setContext(DEEPCODE_CONTEXT.APPROVED, approved);
    return approved;
  }

  public async approveUpload(): Promise<void> {
    this.setUploadApproved(true);
    this.checkApproval();
  } 

}

export default LoginModule;
