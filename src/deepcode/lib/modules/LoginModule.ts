import * as vscode from "vscode";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { setContext, viewInBrowser } from "../../utils/vscodeCommandsUtils";
import ReportModule from "./ReportModule";
import { DEEPCODE_CONTEXT } from "../../constants/views";


const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class LoginModule extends ReportModule implements DeepCode.LoginModuleInterface {
  private pendingLogin: boolean = false;

  public async initiateLogin(): Promise<void> {
    if (this.pendingLogin) {
      return
    }
    this.pendingLogin = true;

    try {
      setContext(DEEPCODE_CONTEXT.LOGGEDIN, false);
      const { login } = deepCodeMessages;
      let pressedButton: string | undefined;

      pressedButton = await vscode.window.showInformationMessage(login.msg, login.button);
      if (pressedButton === login.button) {
        const result = await http.login(this.baseURL, this.source);

        let { sessionToken, loginURL } = result;
        if (!sessionToken || !loginURL) {
          throw new Error();
        }
        await viewInBrowser(loginURL);
        await this.setToken(sessionToken);
        await this.waitLoginConfirmation();
        setContext(DEEPCODE_CONTEXT.LOGGEDIN, true);
      }
    } finally {
      this.pendingLogin = false;
    }
  }

  public async checkSession(): Promise<boolean> {
    if (!this.token) return false;
    const validSession = await http.checkSession(this.baseURL, this.token);
    setContext(DEEPCODE_CONTEXT.LOGGEDIN, !!validSession);
    return validSession;
  }

  private async waitLoginConfirmation(): Promise<void> {
    if (!this.token) return;
    // 20 attempts to wait for user's login & consent
    for (let i = 0; i < 20; i++) {
      await sleep(1000);

      const confirmed = await this.checkSession();
      if (confirmed) {
        return
      }
    }
  }

}

export default LoginModule;
