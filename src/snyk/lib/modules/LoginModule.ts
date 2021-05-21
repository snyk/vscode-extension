import * as vscode from 'vscode';
import { startSession, checkSession } from '@snyk/code-client';
import ReportModule from './ReportModule';
import { LoginModuleInterface } from '../../../interfaces/SnykInterfaces';
import { viewInBrowser, openSnykViewContainer } from '../../utils/vscodeCommandsUtils';
import { SNYK_CONTEXT } from '../../constants/views';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import { snykMessages } from '../../messages/snykMessages';
import { TELEMETRY_EVENTS } from '../../constants/telemetry';
import { configuration } from '../../configuration';

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
            await configuration.setToken(token);
            return;
          }
        } finally {
          this.pendingToken = '';
        }
      }

      const { draftToken, loginURL } = startSession({ authHost: configuration.authHost, source: configuration.source });

      await viewInBrowser(loginURL);
      const token = await this.waitLoginConfirmation(draftToken);
      if (token) {
        await configuration.setToken(token);
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
          authHost: configuration.authHost,
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

  async checkCodeEnabled(): Promise<boolean> {
    const apiEnabled = false; // todo: fetch sast bool from api
    if (!apiEnabled) {
      const pressedButton = await vscode.window.showInformationMessage(
        snykMessages.codeDisabled.msg,
        snykMessages.codeDisabled.enableCode,
        snykMessages.codeDisabled.remindLater,
      );

      if (pressedButton === snykMessages.codeDisabled.enableCode) {
        viewInBrowser(configuration.snykCodeUrl);
      } else {
        // todo: Remind later? how often? every week? every extension activation?
      }
    }

    const inSettingsEnabled = configuration.codeEnabled;
    await this.setContext(SNYK_CONTEXT.CODE_ENABLED, inSettingsEnabled);
    if (!inSettingsEnabled) await this.setLoadingBadge(true);
    // todo: remove old settings entry if enabled

    return inSettingsEnabled;
  }

  async enableCode(): Promise<void> {
    // TODO: set only if org level setting is true
    const apiEnabled = false;
    if (!apiEnabled) {
      return;
    }

    await configuration.setCodeEnabled(true);
    await this.setLoadingBadge(false);
    await this.checkCodeEnabled(); // todo: is it needed?
  }

  async checkWelcomeNotification(): Promise<void> {
    if (configuration.shouldShowWelcomeNotification) {
      this.processEvent(TELEMETRY_EVENTS.viewWelcomeNotification);
      const pressedButton = await vscode.window.showInformationMessage(
        snykMessages.welcome.msg,
        snykMessages.welcome.button,
      );
      if (pressedButton === snykMessages.welcome.button) {
        await openSnykViewContainer();
      }
      await configuration.hideWelcomeNotification();
    }
  }

  async checkAdvancedMode(): Promise<void> {
    await this.setContext(SNYK_CONTEXT.ADVANCED, configuration.shouldShowAdvancedView);
  }
}

export default LoginModule;
