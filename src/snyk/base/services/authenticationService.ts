import { validate as uuidValidate } from 'uuid';
import { IConfiguration } from '../../common/configuration/configuration';
import { SNYK_WORKSPACE_SCAN_COMMAND } from '../../common/constants/commands';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../common/constants/languageServer';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ILog } from '../../common/logger/interfaces';
import { IContextService } from '../../common/services/contextService';
import { IVSCodeCommands } from '../../common/vscode/commands';
import { ILanguageClientAdapter } from '../../common/vscode/languageClient';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IBaseSnykModule } from '../modules/interfaces';

export interface IAuthenticationService {
  initiateLogin(): Promise<void>;

  initiateLogout(): Promise<void>;

  setToken(): Promise<void>;

  updateTokenAndEndpoint(token: string, apiUrl: string): Promise<void>;
}

export type OAuthToken = {
  access_token: string;
  expiry: string;
  refresh_token: string;
};

export class AuthenticationService implements IAuthenticationService {
  constructor(
    private readonly contextService: IContextService,
    private readonly baseModule: IBaseSnykModule,
    private readonly configuration: IConfiguration,
    private readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    private readonly clientAdapter: ILanguageClientAdapter,
    private commands: IVSCodeCommands,
  ) {}

  async initiateLogin(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
    await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, true);
  }

  async initiateLogout(): Promise<void> {
    await this.configuration.clearToken();
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, false);
  }

  async setToken(): Promise<void> {
    const token = await this.window.showInputBox({
      placeHolder: 'UUID for API Token or OAuth2 Token',
      password: true,
      validateInput: token => {
        const valid = this.validateToken(token);
        if (!valid) {
          return 'The entered token has an invalid format.';
        }
      },
    });

    if (!token) return;
    await this.configuration.setToken(token);
    return await this.clientAdapter.getLanguageClient().sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});
  }

  validateToken(token: string) {
    let valid = uuidValidate(token);
    if (valid) return true;

    // try to parse as json (oauth2 token)
    try {
      const oauthToken = JSON.parse(token) as OAuthToken;
      valid =
        oauthToken.access_token.length > 0 &&
        Date.parse(oauthToken.expiry) > Date.now() &&
        oauthToken.refresh_token.length > 0;
      this.logger.debug(`Token ${this.maskToken(token)} parsed`);
    } catch (e) {
      this.logger.warn(`Token ${this.maskToken(token)} is not a valid uuid or json string: ${e}`);
    }
    return valid;
  }

  private maskToken(token: string): string {
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
  }

  async updateTokenAndEndpoint(token: string, apiUrl: string): Promise<void> {
    if (!token) {
      await this.initiateLogout();
    } else {
      if (!this.validateToken(token)) return Promise.reject(new Error('The entered token has an invalid format.'));

      if (apiUrl !== null && apiUrl !== undefined && apiUrl.trim().length > 0) {
        await this.configuration.setEndpoint(apiUrl);
      }

      await this.configuration.setToken(token);
      await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, false);
      await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
      await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED, false);

      this.baseModule.loadingBadge.setLoadingBadge(false);
      await this.commands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND);
    }
  }
}
