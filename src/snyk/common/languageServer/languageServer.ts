import { IAuthenticationService } from '../../base/services/authenticationService';
import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { SNYK_HAS_AUTHENTICATED, SNYK_LANGUAGE_SERVER_NAME } from '../constants/languageServer';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { SNYK_CONTEXT } from '../constants/views';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { getProxyEnvVariable, getProxyOptions } from '../proxy';
import { IContextService } from '../services/contextService';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { LsExecutable } from './lsExecutable';
import { LanguageClientMiddleware } from './middleware';
import { InitializationOptions, LanguageServerSettings } from './settings';

export interface ILanguageServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}
export class LanguageServer implements ILanguageServer {
  private client: LanguageClient;

  constructor(
    private context: ExtensionContext,
    private configuration: IConfiguration,
    private contextService: IContextService,
    private languageClientAdapter: ILanguageClientAdapter,
    private workspace: IVSCodeWorkspace,
    private authenticationService: IAuthenticationService,
    private readonly logger: ILog,
  ) {}

  async start(): Promise<void> {
    // TODO remove feature flag when ready
    if (!this.configuration.getPreviewFeatures().lsAuthenticate) {
      await this.contextService.setContext(SNYK_CONTEXT.PREVIEW_LS_AUTH, false);
      return Promise.resolve(undefined);
    }
    await this.contextService.setContext(SNYK_CONTEXT.PREVIEW_LS_AUTH, true);

    // proxy settings
    const proxyOptions = getProxyOptions(this.workspace);
    const proxyEnvVariable = getProxyEnvVariable(proxyOptions);

    let processEnv = process.env;

    if (proxyEnvVariable) {
      processEnv = {
        ...processEnv,
        // eslint-disable-next-line camelcase
        https_proxy: proxyEnvVariable,
        // eslint-disable-next-line camelcase
        http_proxy: proxyEnvVariable,
      };
    }

    const lsBinaryPath = LsExecutable.getPath(
      this.context.extensionPath,
      this.configuration.getSnykLanguageServerPath(),
    );

    const serverOptions: ServerOptions = {
      command: lsBinaryPath,
      args: ['-l', 'info'], // TODO file logging?
      options: {
        env: processEnv,
      },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: '' }],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initializationOptions: await this.getInitializationOptions(),
      synchronize: {
        configurationSection: CONFIGURATION_IDENTIFIER,
      },
      middleware: new LanguageClientMiddleware(this.context, this.configuration),
    };

    // Create the language client and start the client.
    this.client = this.languageClientAdapter.create('Snyk LS', SNYK_LANGUAGE_SERVER_NAME, serverOptions, clientOptions);

    this.client.onNotification(SNYK_HAS_AUTHENTICATED, ({ token }: { token: string }) => {
      this.authenticationService.updateToken(token).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    // Start the client. This will also launch the server
    return this.client.start();
  }

  async getInitializationOptions(): Promise<InitializationOptions> {
    const settings = await LanguageServerSettings.fromConfiguration(this.configuration, this.context.extensionPath);
    return {
      ...settings,
      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      automaticAuthentication: 'false',
    };
  }

  stop(): Promise<void> {
    if (!this.client) {
      return Promise.resolve(undefined);
    }
    return this.client.stop();
  }
}
