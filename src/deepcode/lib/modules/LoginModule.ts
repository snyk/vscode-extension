import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { ping } from "../../utils/httpUtils";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { DEEPCODE_START_COMMAND, IDE_NAME } from "../../constants/general";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
class LoginModule extends BaseDeepCodeModule {
  private analysisOnSaveAllowed: boolean = false;
  private firstSaveAlreadyHappened: boolean = false;
  private firstConfirmAborted: boolean = false;

  public async login(): Promise<boolean> {
    const isUserLoggedIn = this.store.selectors.getLoggedInStatus();
    this.token = this.store.selectors.getSessionToken();

    if (!isUserLoggedIn || !this.token) {
      await this.showLoginMsg();
    }

    await this.checkLoginStatus();
    return true;
  }

  private async showLoginMsg(): Promise<boolean> {
    const { login } = deepCodeMessages;
    const pressedButton:
      | string
      | undefined = await vscode.window.showInformationMessage(
      login.msg,
      login.button
    );
    if (pressedButton === login.button) {
      try {
        const result = await http.post(this.config.loginUrl, {
          body: { source: IDE_NAME }
        });
        const { sessionToken, loginURL } = result;
        if (!sessionToken || !loginURL) {
          throw new Error();
        }
        this.token = sessionToken;

        await open(loginURL);
        return true;
      } catch (err) {
        this.errorHandler.processError(this, err, {
          ...(err.statusCode === statusCodes.notFound && {
            loginNotFound: true
          }),
          errorDetails: {
            message: errorsLogs.login,
            endpoint: this.config.loginUrl
          }
        });
        return false;
      }
    }
    return false;
  }

  private async checkLoginStatus(): Promise<boolean> {
    if (!this.token) {
      return false;
    }
    const extension: any = this;
    let pingLogin = await ping(async function pingLoginStatus() {
      let result: { [key: string]: number | string | object } | undefined;
      try {
        result = await http.get(
          extension.config.checkSessionUrl,
          extension.token
        );
        await extension.store.actions.setAccountType(result.type);
        await extension.store.actions.setSessionToken(extension.token);
        await extension.store.actions.setLoggedInStatus(true);
        await extension.showConfirmMsg(extension);
      } catch (err) {
        if (err.statusCode === statusCodes.loginInProgress) {
          (async () => {
            pingLogin = await ping(pingLoginStatus);
          })();
        } else {
          extension.errorHandler.processError(extension, err, {
            ...(err.statusCode === statusCodes.notFound && {
              loginNotFound: true
            }),
            errorDetails: {
              message: errorsLogs.loginStatus,
              endpoint: extension.config.checkSessionUrl
            }
          });
        }
      }
    });
    return this.store.selectors.getLoggedInStatus();
  }

  private async showConfirmMsg(
    extension: DeepCode.ExtensionInterface | any
  ): Promise<boolean> {
    const isUploadConfirmed = this.store.selectors.getConfirmUploadStatus();
    if (isUploadConfirmed) {
      return true;
    }
    const { confirmUploadFilesToServer } = deepCodeMessages;
    const { msg, button } = confirmUploadFilesToServer;
    const pressedButton:
      | string
      | undefined = await vscode.window.showInformationMessage(msg, button);
    if (pressedButton === button) {
      await this.store.actions.setConfirmUploadStatus(true);
      if (extension.activateExtensionStartActions) {
        await extension.activateExtensionStartActions();
      }

      return true;
    }
    if (!this.firstConfirmAborted) {
      this.firstConfirmAborted = true;
      this.cancelFirstSaveFlag();
    }
    return false;
  }

  private getLoggedAndConfirmStatus(): { [key: string]: boolean } {
    return {
      isLoggedIn: this.store.selectors.getLoggedInStatus(),
      isUploadConfirmed: this.store.selectors.getConfirmUploadStatus()
    };
  }

  public cancelFirstSaveFlag(): void {
    if (this.firstSaveAlreadyHappened) {
      this.firstSaveAlreadyHappened = false;
    }
  }

  public async firstSaveCheck(
    extension: DeepCode.ExtensionInterface
  ): Promise<boolean> {
    if (this.analysisOnSaveAllowed) {
      return true;
    }

    const { isLoggedIn, isUploadConfirmed } = this.getLoggedAndConfirmStatus();
    if (isLoggedIn && isUploadConfirmed && !this.analysisOnSaveAllowed) {
      this.analysisOnSaveAllowed = true;
      this.firstSaveAlreadyHappened = true;
      return true;
    }
    if (!this.firstSaveAlreadyHappened) {
      this.firstSaveAlreadyHappened = true;

      if (!isLoggedIn) {
        await this.login();
        const {
          isLoggedIn,
          isUploadConfirmed
        } = this.getLoggedAndConfirmStatus();
        this.analysisOnSaveAllowed = isLoggedIn && isUploadConfirmed;
        return this.analysisOnSaveAllowed;
      }

      if (isLoggedIn && !isUploadConfirmed) {
        const resultOfConfirm = await this.showConfirmMsg(extension);
        this.analysisOnSaveAllowed = resultOfConfirm;
        return resultOfConfirm;
      }
    }
    return this.analysisOnSaveAllowed;
  }
}

export default LoginModule;
