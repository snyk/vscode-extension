import { checkSession, getIpFamily as getNetworkFamily, IpFamily, startSession } from '@snyk/code-client';
import { validate as uuidValidate } from 'uuid';
import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ILog } from '../../common/logger/interfaces';
import { IContextService } from '../../common/services/contextService';
import { IOpenerService } from '../../common/services/openerService';
import { IVSCodeWindow } from '../../common/vscode/window';
import { ISnykCodeErrorHandler } from '../../snykCode/error/snykCodeErrorHandler';
import { messages } from '../messages/loginMessages';
import { IBaseSnykModule } from '../modules/interfaces';
import { DID_CHANGE_CONFIGURATION_METHOD, LanguageClient } from '../../common/vscode/types';

export interface IAuthenticationService {
  initiateLogin(getIpFamily: typeof getNetworkFamily): Promise<void>;

  initiateLogout(): Promise<void>;

  checkSession(): Promise<string>;

  setToken(): Promise<void>;

  updateToken(token: string): Promise<void>;
}

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

export class AuthenticationService implements IAuthenticationService {
  private pendingLogin = false;
  private pendingToken = '';

  constructor(
    private readonly contextService: IContextService,
    private readonly openerService: IOpenerService,
    private readonly baseModule: IBaseSnykModule,
    private readonly configuration: IConfiguration,
    private readonly window: IVSCodeWindow,
    private readonly analytics: IAnalytics,
    private readonly logger: ILog,
    private readonly snykCodeErrorHandler: ISnykCodeErrorHandler,
    private readonly client: LanguageClient,
  ) {}

  async initiateLogin(getIpFamily: typeof getNetworkFamily): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);

    if (this.pendingLogin) {
      return;
    }

    const ipFamily = await getIpFamily(this.configuration.authHost);
    if (ipFamily) {
      this.logger.info('IPv6 is used to authenticate.');
    }

    this.analytics.logAuthenticateButtonIsClicked();

    this.pendingLogin = true;
    try {
      // In case we already created a draft token earlier, check if it's confirmed already
      if (this.pendingToken) {
        try {
          const token = await this.checkSession(this.pendingToken, ipFamily);
          if (token) {
            await this.configuration.setToken(token);
            return;
          }
        } finally {
          this.pendingToken = '';
        }
      }

      const { draftToken, loginURL } = startSession({
        authHost: this.configuration.authHost,
        source: this.configuration.source,
      });

      await this.openerService.openBrowserUrl(loginURL);
      void this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, true);
      const token = await this.waitLoginConfirmation(draftToken, ipFamily);
      if (token) {
        await this.configuration.setToken(token);
      } else {
        this.pendingToken = draftToken;
      }
    } catch (err) {
      await this.snykCodeErrorHandler.processError(err, {
        message: messages.loginFailed,
      });
    } finally {
      this.pendingLogin = false;
    }
  }

  async initiateLogout(): Promise<void> {
    await this.configuration.clearToken();
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
  }

  async setToken(): Promise<void> {
    const token = await this.window.showInputBox({
      placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      password: true,
      validateInput: token => {
        const valid = uuidValidate(token);
        if (!valid) {
          return 'The entered token has an invalid format.';
        }
      },
    });

    if (!token) return;
    await this.configuration.setToken(token);
    // TODO remove feature flag when ready
    if (!this.configuration.getPreviewFeatures().lsAuthenticate) {
      return Promise.resolve();
    }
    return await this.client.sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {
      settings: {
        token: token,
      },
    });
  }

  async updateToken(token: string): Promise<void> {
    if (!token) {
      await this.initiateLogout();
    } else {
      if (!uuidValidate(token)) return Promise.reject(new Error('The entered token has an invalid format.'));

      await this.configuration.setToken(token);
      await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, false);
      await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);

      this.baseModule.loadingBadge.setLoadingBadge(false);
    }
  }

  async checkSession(draftToken = '', ipFamily?: IpFamily): Promise<string> {
    let token = '';
    if (draftToken) {
      try {
        const sessionResponse = await checkSession({
          authHost: this.configuration.authHost,
          draftToken,
          ipFamily,
        });
        if (sessionResponse.type === 'error') {
          token = '';
        } else {
          token = sessionResponse.value || '';
        }
      } catch (err) {
        this.logger.error(messages.sessionCheckFailed);
      }
    }
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, !!token);
    if (!token) this.baseModule.loadingBadge.setLoadingBadge(true);
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
}
