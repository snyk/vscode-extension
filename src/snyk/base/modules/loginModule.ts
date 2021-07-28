import { checkSession, startSession } from '@snyk/code-client';
import { getIpFamily, IpFamily } from '@snyk/code-client/dist/http';
import { configuration } from '../../common/configuration';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { Logger } from '../../common/logger/logger';
import { errorsLogs } from '../../common/messages/errorsServerLogMessages';
import { ILoginModule } from './interfaces';
import ReportModule from './reportModule';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

abstract class LoginModule extends ReportModule implements ILoginModule {
  private pendingLogin = false;
  private pendingToken = '';

  async initiateLogin(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);

    if (this.pendingLogin) {
      return;
    }

    const ipFamily = await getIpFamily(configuration.authHost);
    if (ipFamily) {
      Logger.info('IPv6 is used to authenticate.');
    }

    this.pendingLogin = true;
    try {
      // In case we already created a draft token earlier, check if it's confirmed already
      if (this.pendingToken) {
        try {
          const token = await this.checkSession(this.pendingToken, ipFamily);
          if (token) {
            await configuration.setToken(token);
            return;
          }
        } finally {
          this.pendingToken = '';
        }
      }

      const { draftToken, loginURL } = startSession({ authHost: configuration.authHost, source: configuration.source });

      await this.openerService.openBrowserUrl(loginURL);
      void this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, true);
      const token = await this.waitLoginConfirmation(draftToken, ipFamily);
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

  async checkSession(draftToken = '', ipFamily?: IpFamily): Promise<string> {
    let token = '';
    if (draftToken) {
      try {
        const sessionResponse = await checkSession({
          authHost: configuration.authHost,
          draftToken,
          ipFamily,
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
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, !!token);
    if (!token) this.loadingBadge.setLoadingBadge(true, this);
    return token;
  }

  private async waitLoginConfirmation(draftToken: string, ipFamily?: IpFamily): Promise<string> {
    // 90 seconds to wait for user's authentication
    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < 50; i += 1) {
      const waitTime = i < 30 ? 1000 : 3000; // wait 1s for the first 30s, then poll each 3s
      await sleep(waitTime);

      const token = await this.checkSession(draftToken, ipFamily);
      if (token) {
        return token;
      }
    }
    /* eslint-enable no-await-in-loop */

    return '';
  }

  async checkCodeEnabled(): Promise<boolean> {
    const enabled = await this.snykCode.isEnabled();

    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, enabled);
    if (!enabled) {
      this.loadingBadge.setLoadingBadge(true, this);
    }

    return enabled;
  }

  async checkAdvancedMode(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.ADVANCED, configuration.shouldShowAdvancedView);
  }
}

export default LoginModule;
