import { validate as uuidValidate } from 'uuid';
import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../common/constants/languageServer';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ILog } from '../../common/logger/interfaces';
import { IContextService } from '../../common/services/contextService';
import { ILanguageClientAdapter } from '../../common/vscode/languageClient';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IBaseSnykModule } from '../modules/interfaces';

export interface IAuthenticationService {
  initiateLogin(): Promise<void>;
  initiateLogout(): Promise<void>;
  setToken(): Promise<void>;
  updateToken(token: string): Promise<void>;
}

export class AuthenticationService implements IAuthenticationService {
  constructor(
    private readonly contextService: IContextService,
    private readonly baseModule: IBaseSnykModule,
    private readonly configuration: IConfiguration,
    private readonly window: IVSCodeWindow,
    private readonly analytics: IAnalytics,
    private readonly logger: ILog,
    private readonly clientAdapter: ILanguageClientAdapter,
  ) {}

  async initiateLogin(): Promise<void> {
    this.analytics.logAuthenticateButtonIsClicked();
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
    await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, true);
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
    return await this.clientAdapter.getLanguageClient().sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});
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
}
