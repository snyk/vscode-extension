import * as vscode from 'vscode';
import { startSession, checkSession } from '@snyk/code-client';
import ReportModule from './ReportModule';
import { LoginModuleInterface } from '../../../interfaces/SnykInterfaces';
import { viewInBrowser, openSnykViewContainer } from '../../utils/vscodeCommandsUtils';
import { SNYK_CONTEXT } from '../../constants/views';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import { snykMessages } from '../../messages/snykMessages';
import { TELEMETRY_EVENTS } from '../../constants/telemetry';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

abstract class LoginModule extends ReportModule implements LoginModuleInterface {
  private pendingLogin = false;
  private pendingToken = '';

  async initiateLogin(): Promise<void> {
    await this.setContext(SNYK_CONTEXT.LOGGEDIN, false);

    if (this.pendingLogin) {
      return;
    }

    this.pendingLogin = true;
    try {
      // In case we already created a draft token earlier, check if it's confirmed already
      if (this.pendingToken) {
        try {
          const token = await this.checkSession(this.pendingToken);
          if (token) {
            await this.setToken(token);
            return;
          }
        } finally {
          this.pendingToken = '';
        }
      }

      const { draftToken, loginURL } = startSession({ authHost: this.authHost, source: this.source });

      await viewInBrowser(loginURL);
      const token = await this.waitLoginConfirmation(draftToken);
      if (token) {
        await this.setToken(token);
      } else {
        this.pendingToken = draftToken;
      }
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.login,
      });
    } finally {
      this.pendingLogin = false;
    }
  }

  async checkSession(draftToken = ''): Promise<string> {
    let token = '';
    if (draftToken) {
      try {
        const sessionResponse = await checkSession({
          authHost: this.authHost,
          draftToken,
        });
        if (sessionResponse.type === 'error') {
          token = '';
        } else {
          token = sessionResponse.value || '';
        }
      } catch (err) {
        await this.processError(err, {
          message: errorsLogs.loginStatus,
        });
      }
    }
    await this.setContext(SNYK_CONTEXT.LOGGEDIN, !!token);
    if (!token) await this.setLoadingBadge(true);
    return token;
  }

  private async waitLoginConfirmation(draftToken: string): Promise<string> {
    // 20 attempts to wait for user's login & consent
    for (let i = 0; i < 20; i += 1) {
      await sleep(1000);

      const token = await this.checkSession(draftToken);
      if (token) {
        return token;
      }
    }
    return '';
  }

  async checkApproval(): Promise<boolean> {
    const approved = this.uploadApproved;
    await this.setContext(SNYK_CONTEXT.APPROVED, approved);
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
      const pressedButton = await vscode.window.showInformationMessage(
        snykMessages.welcome.msg,
        snykMessages.welcome.button,
      );
      if (pressedButton === snykMessages.welcome.button) {
        await openSnykViewContainer();
      }
      await this.hideWelcomeNotification();
    }
  }

  async checkAdvancedMode(): Promise<void> {
    await this.setContext(SNYK_CONTEXT.ADVANCED, this.shouldShowAdvancedView);
  }
}

export default LoginModule;
