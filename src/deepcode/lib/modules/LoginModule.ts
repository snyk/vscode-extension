import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { ping } from "../../utils/httpUtils";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { IDE_NAME } from "../../constants/general";
import BaseDeepCodeModule from "./BaseDeepCodeModule";
import { statusCodes } from "../../constants/statusCodes";
class LoginModule extends BaseDeepCodeModule {
  private analysisOnSaveAllowed: { [key: string]: boolean } = {};
  private firstSaveAlreadyHappened: { [key: string]: boolean } = {};
  private firstConfirmAborted: boolean = false;
  private pendingLogin: boolean = false;

  public async login(): Promise<boolean> {
    const isUserLoggedIn = this.store.selectors.getLoggedInStatus();
    this.token = this.store.selectors.getSessionToken();

    if (!isUserLoggedIn || !this.token) {
      await this.showLoginMsg();
    }

    const loginStatus = await this.checkLoginStatus();
    return loginStatus;
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

  private async checkLoginStatus(): Promise<any> {
    if (!this.token) {
      return false;
    }
    const extension: any = this;
    return await ping(async function pingLoginStatus() {
      extension.pendingLogin = true;
      let result: { [key: string]: number | string | object } | undefined;
      try {
        result = await http.get(
          extension.config.checkSessionUrl,
          extension.token
        );
        await extension.store.actions.setLoggedInStatus(true);
        await extension.store.actions.setAccountType(result.type);
        await extension.store.actions.setSessionToken(extension.token);
        extension.pendingLogin = false;
        return true;
      } catch (err) {
        if (err.statusCode === statusCodes.loginInProgress) {
          return await ping(pingLoginStatus);
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
          return false;
        }
      }
    });
  }

  public async showConfirmMsg(
    extension: DeepCode.ExtensionInterface | any,
    folderPath: string
  ): Promise<boolean> {
    const isUploadConfirmed = this.store.selectors.getConfirmUploadStatus(
      folderPath
    );
    if (isUploadConfirmed) {
      return true;
    }
    const { msg, button } = deepCodeMessages.confirmUploadFilesToServer;
    const pressedButton:
      | string
      | undefined = await vscode.window.showInformationMessage(
      msg(extension.config.termsConditionsUrl, folderPath),
      button
    );
    if (pressedButton === button) {
      await this.store.actions.setConfirmUploadStatus(folderPath, true);
      return true;
    } else {
      await this.store.actions.setConfirmUploadStatus(folderPath, false);
    }

    if (!this.firstConfirmAborted) {
      this.firstConfirmAborted = true;
      this.cancelFirstSaveFlag();
    }
    return false;
  }

  private getLoggedAndConfirmStatus(
    folderPath: string
  ): { [key: string]: boolean } {
    return {
      isLoggedIn: this.store.selectors.getLoggedInStatus(),
      isUploadConfirmed: this.store.selectors.getConfirmUploadStatus(folderPath)
    };
  }

  public cancelFirstSaveFlag(): void {
    if (Object.keys(this.firstSaveAlreadyHappened).length) {
      this.firstSaveAlreadyHappened = {};
    }
  }

  public checkUploadConfirm(folderPath: string): boolean {
    const isAllowed = this.store.selectors.getConfirmUploadStatus(folderPath);
    return isAllowed;
  }

  public async firstSaveCheck(
    extension: DeepCode.ExtensionInterface,
    folderPath: string
  ): Promise<boolean> {
    if (this.analysisOnSaveAllowed[folderPath]) {
      return true;
    }
    const { isLoggedIn, isUploadConfirmed } = this.getLoggedAndConfirmStatus(
      folderPath
    );
    if (
      isLoggedIn &&
      isUploadConfirmed &&
      !this.analysisOnSaveAllowed[folderPath]
    ) {
      this.analysisOnSaveAllowed[folderPath] = true;
      this.firstSaveAlreadyHappened[folderPath] = true;
      return true;
    }
    if (!this.firstSaveAlreadyHappened[folderPath]) {
      this.firstSaveAlreadyHappened[folderPath] = !!folderPath;

      const isBackendConfigured = await extension.store.selectors.getBackendConfigStatus();
      if (!isBackendConfigured) {
        await extension.configureExtension();
        const latestIsBackendConfigured = await extension.store.selectors.getBackendConfigStatus();
        if (latestIsBackendConfigured) {
          this.firstSaveAlreadyHappened[folderPath] = false;
        }
        return false;
      }

      if (!isLoggedIn && !this.pendingLogin) {
        await extension.activateActions();
        const {
          isLoggedIn,
          isUploadConfirmed
        } = this.getLoggedAndConfirmStatus(folderPath);

        this.analysisOnSaveAllowed[folderPath] =
          isLoggedIn && isUploadConfirmed;
        return this.analysisOnSaveAllowed[folderPath];
      }

      if (isLoggedIn && !isUploadConfirmed && folderPath) {
        const resultOfConfirm = await this.showConfirmMsg(
          extension,
          folderPath
        );

        this.analysisOnSaveAllowed[folderPath] = resultOfConfirm;
        return resultOfConfirm;
      }
    }
    return this.analysisOnSaveAllowed[folderPath];
  }
}

export default LoginModule;
