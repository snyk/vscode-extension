import * as vscode from "vscode";
import ReportModule from "./ReportModule";
import { LoginModuleInterface } from "../../../interfaces/DeepCodeInterfaces";
import { viewInBrowser } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT } from "../../constants/views";
import { openDeepcodeViewContainer } from "../../utils/vscodeCommandsUtils";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";

import { startSession, checkSession } from '@deepcode/tsc';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

abstract class LoginModule extends ReportModule implements LoginModuleInterface {
  private pendingLogin: boolean = false;

  async initiateLogin(): Promise<void> {

    await this.setContext(DEEPCODE_CONTEXT.LOGGEDIN, false);

    if (this.pendingLogin) {
      return;
    }

    this.pendingLogin = true;
    try {
      const checkCurrentToken = await this.checkSession();
      if (checkCurrentToken) return;
      const response = await startSession({ baseURL: this.baseURL, source: this.source });
      if (response.type == 'error') {
        throw new Error(errorsLogs.login);
      }

      const { sessionToken, loginURL } = response.value;

      await this.setToken(sessionToken);
      await viewInBrowser(loginURL);
      await this.waitLoginConfirmation();
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.login
      });
    } finally {
      this.pendingLogin = false;
    }
  }

  async checkSession(): Promise<boolean> {
    let validSession = false;
    if (this.token) {
      try {
        validSession = !!(await checkSession({
          baseURL: this.baseURL,
          sessionToken: this.token,
        }));
      } catch (err) {
        await this.processError(err, {
          message: errorsLogs.loginStatus
        });
      }
    }
    await this.setContext(DEEPCODE_CONTEXT.LOGGEDIN, validSession);
    if (!validSession) await this.setLoadingBadge(true);
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

  async checkApproval(): Promise<boolean> {
    const approved = this.uploadApproved;
    await this.setContext(DEEPCODE_CONTEXT.APPROVED, approved);
    if (!approved) await this.setLoadingBadge(true);
    return approved;
  }

  async approveUpload(): Promise<void> {
    await this.setUploadApproved(true);
    await this.setLoadingBadge(false);
    await this.checkApproval();
  }

  async checkWelcomeNotification(): Promise<void> {
    if (this.shouldShowWelcomeNotification) {
      this.processEvent(TELEMETRY_EVENTS.viewWelcomeNotification);
      let pressedButton = await vscode.window.showInformationMessage(
        deepCodeMessages.welcome.msg,
        deepCodeMessages.welcome.button
      );
      if (pressedButton === deepCodeMessages.welcome.button) {
        await openDeepcodeViewContainer();
      }
      await this.hideWelcomeNotification();
    }
  }

  async checkAdvancedMode(): Promise<void> {
    await this.setContext(DEEPCODE_CONTEXT.ADVANCED, this.shouldShowAdvancedView);
  }
}

export default LoginModule;
