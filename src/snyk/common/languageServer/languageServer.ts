import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { SNYK_LANGUAGE_SERVER_NAME } from '../constants/general';
import { getProxyEnvVariable, getProxyOptions } from '../proxy';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { CliExecutable } from '../../cli/cliExecutable';

export interface ILanguageServer {
  start(): Promise<void>;

  stop(): Promise<void>;
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

  async start(): Promise<void> {
    // TODO remove feature flag when ready
    if (!this.configuration.getPreviewFeatures().lsAuthenticate) {
      return Promise.resolve(undefined);
    }

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

    const serverOptions: ServerOptions = {
      command: this.configuration.getSnykLanguageServerPath(),
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
    };
    // Create the language client and start the client.
    this.client = this.languageClientAdapter.create('Snyk LS', SNYK_LANGUAGE_SERVER_NAME, serverOptions, clientOptions);

    // Start the client. This will also launch the server
    return this.client.start();
  }

  async getInitializationOptions() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let initOptions: any = {
      activateSnykCode: 'false',
      activateSnykOpenSource: 'false',
      activateSnykIac: 'false',
      enableTelemetry: `${this.configuration.shouldReportEvents}`,
      sendErrorReports: `${this.configuration.shouldReportErrors}`,
      cliPath: CliExecutable.getPath(this.context.extensionPath, this.configuration.getCustomCliPath()),
      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
    };

    if (this.configuration.snykOssApiEndpoint) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initOptions = {
        ...initOptions,
        endpoint: this.configuration.snykOssApiEndpoint,
      };
    }
    if (this.configuration.organization) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initOptions = {
        ...initOptions,
        organization: this.configuration.organization,
      };
    }
    const token = await this.configuration.getToken();
    if (token) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      initOptions = {
        ...initOptions,
        token: token,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return initOptions;
  }

  stop(): Promise<void> {
    if (!this.client) {
      return Promise.resolve(undefined);
    }
    return this.client.stop();
  }
}
