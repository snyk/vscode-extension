import _ from 'lodash';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { FolderConfig, IConfiguration } from '../configuration/configuration';
import {
  SNYK_ADD_TRUSTED_FOLDERS,
  SNYK_FOLDERCONFIG,
  SNYK_HAS_AUTHENTICATED,
  SNYK_LANGUAGE_SERVER_NAME,
  SNYK_SCAN,
  SNYK_SCANSUMMARY,
} from '../constants/languageServer';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { getProxyEnvVariable, getProxyOptions } from '../proxy';
import { DownloadService } from '../services/downloadService';
import { User } from '../user';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { LanguageClientMiddleware } from './middleware';
import { LanguageServerSettings, ServerSettings } from './settings';
import { CodeIssueData, IacIssueData, OssIssueData, Scan, ShowIssueDetailTopicParams } from './types';
import { IExtensionRetriever } from '../vscode/extensionContext';
import { ISummaryProviderService } from '../../base/summary/summaryProviderService';
import { GeminiIntegrationService } from '../llm/geminiIntegrationService';
import { IUriAdapter } from '../vscode/uri';
import { IMarkdownStringAdapter } from '../vscode/markdownString';
import { IVSCodeCommands } from '../vscode/commands';
import { IDiagnosticsIssueProvider } from '../services/diagnosticsService';

export interface ILanguageServer {
  start(): Promise<void>;

  stop(): Promise<void>;

  showOutputChannel(): void;

  cliReady$: ReplaySubject<string>;
  scan$: Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>;
  showIssueDetailTopic$: Subject<ShowIssueDetailTopicParams>;
}

export class LanguageServer implements ILanguageServer {
  private client: LanguageClient;
  readonly cliReady$ = new ReplaySubject<string>(1);
  readonly scan$ = new Subject<Scan<CodeIssueData | OssIssueData | IacIssueData>>();
  private geminiIntegrationService: GeminiIntegrationService;
  readonly showIssueDetailTopic$ = new Subject<ShowIssueDetailTopicParams>();
  public static ReceivedFolderConfigsFromLs = false;

  constructor(
    private user: User,
    private configuration: IConfiguration,
    private languageClientAdapter: ILanguageClientAdapter,
    private workspace: IVSCodeWorkspace,
    private window: IVSCodeWindow,
    private authenticationService: IAuthenticationService,
    private readonly logger: ILog,
    private downloadService: DownloadService,
    private extensionRetriever: IExtensionRetriever,
    private summaryProvider: ISummaryProviderService,
    private readonly uriAdapter: IUriAdapter,
    private readonly markdownAdapter: IMarkdownStringAdapter,
    private readonly codeCommands: IVSCodeCommands,
    private readonly diagnosticsProvider: IDiagnosticsIssueProvider<unknown>,
  ) {
    this.downloadService = downloadService;
    this.geminiIntegrationService = new GeminiIntegrationService(
      this.logger,
      this.configuration,
      this.extensionRetriever,
      this.scan$,
      this.uriAdapter,
      this.markdownAdapter,
      this.codeCommands,
      this.diagnosticsProvider,
    );
  }

  // Starts the language server and the client. LS will be downloaded if missing.
  // Returns a promise that resolves when the language server is ready to receive requests.
  async start(): Promise<void> {
    // wait until Snyk LS is downloaded
    await firstValueFrom(this.downloadService.downloadReady$);
    this.logger.info('Starting Snyk Language Server');

    // proxy settings
    const proxyOptions = await getProxyOptions(this.workspace, this.configuration, this.logger);
    const proxyEnvVariable = getProxyEnvVariable(proxyOptions);

    let processEnv = process.env;

    if (proxyEnvVariable) {
      processEnv = {
        ...processEnv,
        HTTPS_PROXY: proxyEnvVariable,
        HTTP_PROXY: proxyEnvVariable,
      };
    }

    const cliBinaryPath = await this.configuration.getCliPath();

    // log level is set to info by default
    let logLevel = 'info';
    const additionalCliParameters = this.configuration.getAdditionalCliParameters();
    if (
      additionalCliParameters != null &&
      additionalCliParameters.length > 0 &&
      (additionalCliParameters.includes('-d') || additionalCliParameters.includes('--debug'))
    ) {
      logLevel = 'debug';
    }
    logLevel = process.env.SNYK_LOG_LEVEL ?? logLevel;

    const args = ['language-server', '-l', logLevel];
    this.logger.info(`Snyk Language Server - path: ${cliBinaryPath}`);
    this.logger.info(`Snyk Language Server - args: ${args}`);
    const serverOptions: ServerOptions = {
      command: cliBinaryPath,
      args: args,
      options: {
        env: processEnv,
      },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: '' }],
      initializationOptions: await this.getInitializationOptions(),
      synchronize: {
        configurationSection: CONFIGURATION_IDENTIFIER,
      },
      middleware: new LanguageClientMiddleware(this.logger, this.configuration, this.user, this.showIssueDetailTopic$),
      /**
       * We reuse the output channel here as it's not properly disposed of by the language client (vscode-languageclient@8.0.0-next.2)
       * See: https://github.com/microsoft/vscode-languageserver-node/blob/cdf4d6fdaefe329ce417621cf0f8b14e0b9bb39d/client/src/common/client.ts#L2789
       */
      outputChannel: this.client?.outputChannel ?? this.window.createOutputChannel(SNYK_LANGUAGE_SERVER_NAME),
    };

    // Create the language client and start the client.
    this.client = this.languageClientAdapter.create('SnykLS', SNYK_LANGUAGE_SERVER_NAME, serverOptions, clientOptions);

    try {
      // register listeners before starting the client
      this.registerListeners(this.client);

      // Start the client. This will also launch the server
      await this.client.start();
      void this.geminiIntegrationService.connectGeminiToMCPServer();
      this.logger.info('Snyk Language Server started');
    } catch (error) {
      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private registerListeners(client: LanguageClient): void {
    client.onNotification(SNYK_HAS_AUTHENTICATED, ({ token, apiUrl }: { token: string; apiUrl: string }) => {
      this.authenticationService.updateTokenAndEndpoint(token, apiUrl).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_FOLDERCONFIG, ({ folderConfigs }: { folderConfigs: FolderConfig[] }) => {
      LanguageServer.ReceivedFolderConfigsFromLs = true;
      this.configuration.setFolderConfigs(folderConfigs).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
      });
    });

    client.onNotification(SNYK_ADD_TRUSTED_FOLDERS, ({ trustedFolders }: { trustedFolders: string[] }) => {
      this.configuration.setTrustedFolders(trustedFolders).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_SCAN, (scan: Scan<CodeIssueData | OssIssueData | IacIssueData>) => {
      this.logger.info(`${_.capitalize(scan.product)} scan for ${scan.folderPath}: ${scan.status}.`);
      this.scan$.next(scan);
    });

    client.onNotification(SNYK_SCANSUMMARY, ({ scanSummary }: { scanSummary: string }) => {
      this.summaryProvider.updateSummaryPanel(scanSummary);
    });
  }

  // Initialization options are not semantically equal to server settings, thus separated here
  // https://github.com/microsoft/language-server-protocol/issues/567
  async getInitializationOptions(): Promise<ServerSettings> {
    return await LanguageServerSettings.fromConfiguration(this.configuration, this.user);
  }

  showOutputChannel(): void {
    if (!this.client) {
      return;
    }

    this.client.outputChannel.show();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Snyk Language Server...');
    if (!this.client) {
      return Promise.resolve();
    }

    if (this.client?.needsStop()) {
      await this.client.stop();
    }

    this.logger.info('Snyk Language Server stopped');
  }
}
