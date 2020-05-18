import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
import { IDE_NAME } from "../../constants/general";

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class LoginModule extends BaseDeepCodeModule implements DeepCode.LoginModuleInterface {
  private pendingLogin: boolean = false;

  public async initiateLogin(): Promise<void> {
    
    if (this.pendingLogin) {
      return
    }
    this.pendingLogin = true;
    
    try {
      const { login } = deepCodeMessages;
      let pressedButton: string | undefined;
      
      pressedButton = await vscode.window.showInformationMessage(login.msg, login.button);
      if (pressedButton === login.button) {
        const source = process.env['GITPOD_WORKSPACE_ID'] ? 'gitpod' : IDE_NAME;
        const result = await http.login(this.baseURL, source);
        
        let { sessionToken, loginURL } = result;
        if (!sessionToken || !loginURL) {
          throw new Error();
        }
        await open(loginURL);
        await this.waitLoginOnline(sessionToken);
      }
    } finally {
      this.pendingLogin = false;
    }
  }

  private async waitLoginOnline(token: string): Promise<void> {
    // 20 attempts to wait for user's login & consent
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      
      const confirmed = await http.checkSession(this.baseURL, token);
      if (!confirmed) {
        continue
      }

      this.token = token;
      return;
    }
  }

}

export default LoginModule;
