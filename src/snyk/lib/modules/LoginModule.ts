import { checkSession, startSession } from '@snyk/code-client';
import { LoginModuleInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import { SNYK_CONTEXT } from '../../constants/views';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import { viewInBrowser } from '../../utils/vscodeCommandsUtils';
import { ISnykCode, SnykCode } from './code';
import ReportModule from './ReportModule';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

abstract class LoginModule extends ReportModule implements LoginModuleInterface {
  private pendingLogin = false;
  private pendingToken = '';

  private snykCode: ISnykCode;

  constructor() {
    super();
    this.snykCode = new SnykCode(configuration);
  }

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
    if (!token) this.loadingBadge.setLoadingBadge(true, this);
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
    const enabled = await this.snykCode.isEnabled();

    await this.setContext(SNYK_CONTEXT.CODE_ENABLED, enabled);
    await this.setContext(SNYK_CONTEXT.APPROVED, configuration.uploadApproved); // todo: removed once 'uploadApproved' is deprecated
    if (!enabled) {
      this.loadAnalytics();

      this.loadingBadge.setLoadingBadge(true, this);
    }

    return enabled;
  }

  async enableCode(): Promise<void> {
    const wasEnabled = await this.snykCode.enable();
    if (wasEnabled) {
      this.loadingBadge.setLoadingBadge(false, this);
      await this.checkCodeEnabled();
    }
  }

  async checkAdvancedMode(): Promise<void> {
    await this.setContext(SNYK_CONTEXT.ADVANCED, configuration.shouldShowAdvancedView);
  }
}

export default LoginModule;
