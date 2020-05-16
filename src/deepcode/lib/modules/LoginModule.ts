import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
import { IDE_NAME } from "../../constants/general";

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class LoginModule extends BaseDeepCodeModule implements DeepCode.LoginModuleInterface {
  private pendingLogin: boolean = false;

  public async login(): Promise<boolean> {
    if (this.pendingLogin) {
      return false;
    }
    this.pendingLogin = true;
    if (!this.token) {
      const draftToken = await this.initiateLogin();
      const loginStatus = await this.checkLoginStatus(draftToken);
      if (loginStatus) {
        this.token = draftToken;
      }
    }

    this.pendingLogin = false;
    return true;
  }

  private async initiateLogin(): Promise<string> {
    const { login } = deepCodeMessages;
    let pressedButton: string | undefined;
    do {
      pressedButton = await vscode.window.showInformationMessage(login.msg, login.button);
      if (pressedButton === login.button) {
        try {
          const source = process.env['GITPOD_WORKSPACE_ID'] ? 'gitpod' : IDE_NAME;
          const result = await http.login(this.baseURL, source);
          
          let { sessionToken, loginURL } = result;
          if (!sessionToken || !loginURL) {
            throw new Error();
          }
          await open(loginURL);
          return sessionToken;
        } catch (err) {
          this.errorHandler.processError(this, err, {
            ...(err.statusCode === statusCodes.notFound && {
              loginNotFound: true
            }),
            errorDetails: {
              message: errorsLogs.login,
            }
          });
        }
      }
    } while (pressedButton !== login.button)
    
    return '';
  }

  private async checkLoginStatus(token: string): Promise<any> {
    if (!token) {
      return false;
    }
    const extension: any = this;

    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      try {
        const result = await http.checkLoginStatus(extension.baseURL, token);
        if (!result.isLoggedIn) {
          continue
        }

        await extension.store.actions.setServerConnectionAttempts(10);
        return true;

      } catch (err) {
        if (err.statusCode === statusCodes.loginInProgress) {
          continue
        }

        extension.errorHandler.processError(extension, err, {
          ...(err.statusCode === statusCodes.notFound && {
            loginNotFound: true
          }),
          errorDetails: {
            message: errorsLogs.loginStatus,
          }
        });

        return false;
      }

    }

    return false;
  }

}

export default LoginModule;
