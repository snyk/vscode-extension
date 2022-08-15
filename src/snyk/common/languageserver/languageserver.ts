import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { SNYK_LANGUAGE_SERVER_NAME } from '../constants/general';
import { getProxyEnvVariable, getProxyOptions } from '../proxy';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWorkspace } from '../vscode/workspace';

export interface ILanguageServer {
  start(): Promise<void>;

  stop(): Promise<void>;

  setConfig(config: IConfiguration): void;
}

export class LanguageServer implements ILanguageServer {
  private context: ExtensionContext;
  private languageClientAdapter: ILanguageClientAdapter;
  private readonly workspace: IVSCodeWorkspace;

  constructor(
    context: ExtensionContext,
    configuration: IConfiguration,
    languageClientAdapter: ILanguageClientAdapter,
    workspace: IVSCodeWorkspace,
  ) {
    this.configuration = configuration;
    this.context = context;
    this.languageClientAdapter = languageClientAdapter;
    this.workspace = workspace;
  }

  private configuration: IConfiguration;
  private client: LanguageClient;

  setConfig(config: IConfiguration): void {
    this.configuration = config;
  }

  async start(): Promise<void> {
    // TODO remove feature flag when ready
    if (!this.configuration.getPreviewFeatures().lsAuthenticate) {
      return Promise.resolve(undefined);
    }

    // proxy settings
    const proxyOptions = getProxyOptions(this.workspace);
    const proxyEnvVariable = getProxyEnvVariable(proxyOptions);

    // until a path can be configured
    const serverOptions: ServerOptions = {
      command: this.configuration.getSnykLanguageServerPath(),
      args: ['-l', 'info'], // TODO file logging?
      options: {
        env: {
          ...process.env,
          // eslint-disable-next-line camelcase
          https_proxy: proxyEnvVariable,
          // eslint-disable-next-line camelcase
          http_proxy: proxyEnvVariable,
        },
      },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: '' }],
      initializationOptions: await this.getInitializationOptions(),
    };
    // Create the language client and start the client.
    this.client = this.languageClientAdapter.create('Snyk LS', SNYK_LANGUAGE_SERVER_NAME, serverOptions, clientOptions);

    // Start the client. This will also launch the server
    return this.client.start();
  }

  async getInitializationOptions() {
    return {
      activateSnykCode: 'false',
      activateSnykOpenSource: 'false',
      activateSnykIac: 'false',
      enableTelemetry: `${this.configuration.shouldReportEvents}`,
      sendErrorReports: `${this.configuration.shouldReportErrors}`,
      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      token: await this.configuration.getToken(),
      cliPath: this.configuration.getCustomCliPath(),
    };
  }

  stop(): Promise<void> {
    if (!this.client) {
      return Promise.resolve(undefined);
    }
    return this.client.stop();
  }
}
