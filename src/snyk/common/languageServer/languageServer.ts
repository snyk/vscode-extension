import _ from 'lodash';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import {
  PROTOCOL_VERSION,
  SNYK_ADD_TRUSTED_FOLDERS,
  SNYK_CONFIGURATION,
  SNYK_REGISTER_MCP,
  SNYK_HAS_AUTHENTICATED,
  SNYK_LANGUAGE_SERVER_NAME,
  SNYK_SCAN,
  SNYK_SCANSUMMARY,
  SNYK_TREEVIEW,
} from '../constants/languageServer';
import { CONFIGURATION_IDENTIFIER } from '../constants/settings';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { DownloadService } from '../services/downloadService';
import { User } from '../user';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { LanguageClientMiddleware } from './middleware';
import { markExplicitLsKeysFromConfigurationChangeEvent } from './explicitLsKeyTracking';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import { LanguageServerSettings } from './settings';
import { LspConfigurationParam, type LspInitializationOptions, Scan, ShowIssueDetailTopicParams } from './types';
import { IExtensionRetriever } from '../vscode/extensionContext';
import { ISummaryProviderService } from '../../base/summary/summaryProviderService';
import { ITreeViewProviderService } from '../../base/treeView/treeViewProviderService';
import { GeminiIntegrationService } from '../llm/geminiIntegrationService';
import { IUriAdapter } from '../vscode/uri';
import { IMarkdownStringAdapter } from '../vscode/markdownString';
import { IVSCodeCommands } from '../vscode/commands';
import { IDiagnosticsIssueProvider } from '../services/diagnosticsService';
import { IMcpProvider } from '../vscode/mcpProvider';
import { IWorkspaceConfigurationWebviewProvider } from '../views/workspaceConfiguration/types/workspaceConfiguration.types';

export interface ILanguageServer {
  start(): Promise<void>;

  stop(): Promise<void>;

  showOutputChannel(): void;

  setWorkspaceConfigurationProvider(provider: IWorkspaceConfigurationWebviewProvider): void;

  setInboundConfigurationPersistenceHandler(handler: (view: LspConfigurationParam) => Promise<void>): void;

  cliReady$: ReplaySubject<string>;
  scan$: Subject<Scan>;
  showIssueDetailTopic$: Subject<ShowIssueDetailTopicParams>;
}

export class LanguageServer implements ILanguageServer {
  private client: LanguageClient;
  readonly cliReady$ = new ReplaySubject<string>(1);
  readonly scan$ = new Subject<Scan>();
  private geminiIntegrationService: GeminiIntegrationService;
  readonly showIssueDetailTopic$ = new Subject<ShowIssueDetailTopicParams>();

  private workspaceConfigurationProvider?: IWorkspaceConfigurationWebviewProvider;
  private configurationChangeDisposable?: Disposable;
  /** When true, VS Code `settings.json` updates triggered by inbound LS persistence are suppressed from feeding back to the LS. */
  private suppressConfigFeedbackFromInboundPersistence = false;
  /** Serializes disk persistence so concurrent `$/snyk.configuration` handlers do not interleave writes. */
  private configPersistenceQueue: Promise<void> = Promise.resolve();
  private persistInboundConfiguration?: (view: LspConfigurationParam) => Promise<void>;

  setWorkspaceConfigurationProvider(provider: IWorkspaceConfigurationWebviewProvider): void {
    this.workspaceConfigurationProvider = provider;
  }

  /**
   * Persists each inbound `$/snyk.configuration` global snapshot into VS Code settings
   * (see {@link ConfigurationPersistenceService.persistInboundLspConfiguration}).
   */
  setInboundConfigurationPersistenceHandler(handler: (view: LspConfigurationParam) => Promise<void>): void {
    this.persistInboundConfiguration = handler;
  }

  constructor(
    private user: User,
    private configuration: IConfiguration,
    private languageClientAdapter: ILanguageClientAdapter,
    private workspace: IVSCodeWorkspace,
    private window: IVSCodeWindow,
    private authenticationService: IAuthenticationService,
    private readonly logger: ILog,
    private downloadService: DownloadService,
    private readonly mcpProvider: IMcpProvider,
    private extensionRetriever: IExtensionRetriever,
    private summaryProvider: ISummaryProviderService,
    private readonly uriAdapter: IUriAdapter,
    private readonly markdownAdapter: IMarkdownStringAdapter,
    private readonly codeCommands: IVSCodeCommands,
    private readonly diagnosticsProvider: IDiagnosticsIssueProvider<unknown>,
    private readonly explicitLspConfigurationChangeTracker: IExplicitLspConfigurationChangeTracker,
    private readonly treeViewProvider?: ITreeViewProviderService,
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

    // proxy settings - get directly from VSCode configuration
    const httpProxy = this.workspace.getConfiguration<string>('http', 'proxy');

    let processEnv = process.env;

    if (httpProxy) {
      processEnv = {
        ...processEnv,
        HTTPS_PROXY: httpProxy,
        HTTP_PROXY: httpProxy,
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
      // vscode-languageclient types `initializationOptions` loosely; value is LspInitializationOptions
      initializationOptions: (await this.getInitializationOptions()) as unknown,
      synchronize: {
        configurationSection: CONFIGURATION_IDENTIFIER,
      },
      middleware: new LanguageClientMiddleware(
        this.logger,
        this.configuration,
        this.showIssueDetailTopic$,
        this.uriAdapter,
        this.codeCommands,
        this.workspace,
        this.explicitLspConfigurationChangeTracker,
        () => this.suppressConfigFeedbackFromInboundPersistence,
      ),
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
      this.registerExplicitKeyMarkingListener();
      void this.geminiIntegrationService.connectGeminiToMCPServer();
      this.logger.info('Snyk Language Server started');
    } catch (error) {
      this.logger.error(
        `Language Server startup failed: ${error instanceof Error ? error.message : 'An error occurred'}`,
      );

      // If startup failed and automatic downloads are enabled, verify CLI integrity
      if (this.configuration.isAutomaticDependencyManagementEnabled()) {
        this.logger.info('Verifying CLI integrity and attempting repair...');
        const cliRepaired = await this.downloadService.verifyAndRepairCli();

        if (cliRepaired) {
          this.logger.info('CLI repaired, retrying Language Server startup...');
          try {
            // Recreate the client with the same options since the previous one may be in a bad state
            this.client = this.languageClientAdapter.create(
              'SnykLS',
              SNYK_LANGUAGE_SERVER_NAME,
              serverOptions,
              clientOptions,
            );
            this.registerListeners(this.client);
            await this.client.start();
            this.registerExplicitKeyMarkingListener();
            void this.geminiIntegrationService.connectGeminiToMCPServer();
            this.logger.info('Snyk Language Server started successfully after CLI repair');
            return;
          } catch (retryError) {
            this.logger.error(
              `Language Server startup failed even after CLI repair: ${
                retryError instanceof Error ? retryError.message : 'An error occurred'
              }`,
            );
          }
        }
      }

      return ErrorHandler.handle(error, this.logger, error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private registerListeners(client: LanguageClient): void {
    client.onNotification(SNYK_HAS_AUTHENTICATED, ({ token, apiUrl }: { token: string; apiUrl: string }) => {
      this.authenticationService
        .updateTokenAndEndpoint(token, apiUrl)
        .then(() => {
          this.workspaceConfigurationProvider?.setAuthToken(token, apiUrl);
        })
        .catch((error: Error) => {
          ErrorHandler.handle(error, this.logger, error.message);
        });
    });

    client.onNotification(SNYK_ADD_TRUSTED_FOLDERS, ({ trustedFolders }: { trustedFolders: string[] }) => {
      this.configuration.setTrustedFolders(trustedFolders).catch((error: Error) => {
        ErrorHandler.handle(error, this.logger, error.message);
      });
    });

    client.onNotification(SNYK_SCAN, (scan: Scan) => {
      this.logger.info(`${_.capitalize(scan.product)} scan for ${scan.folderPath}: ${scan.status}.`);
      this.scan$.next(scan);
    });

    client.onNotification(SNYK_SCANSUMMARY, ({ scanSummary }: { scanSummary: string }) => {
      this.summaryProvider.updateSummaryPanel(scanSummary);
    });

    client.onNotification(
      SNYK_REGISTER_MCP,
      (mcpConfig: { command: string; args: string[]; env: Record<string, string> }) => {
        this.mcpProvider.registerMcpServer(mcpConfig);
      },
    );

    client.onNotification(SNYK_TREEVIEW, ({ treeViewHtml }: { treeViewHtml: string }) => {
      if (this.treeViewProvider) {
        this.treeViewProvider.updateTreeViewPanel(treeViewHtml);
      }
    });

    client.onNotification(SNYK_CONFIGURATION, (params: LspConfigurationParam) => {
      this.handleSnykConfigurationNotification(params);
    });
  }

  /**
   * Marks which LS keys the user explicitly changed via native VS Code settings,
   * so the middleware can set `changed: true` on the next `workspace/configuration` pull response.
   */
  private registerExplicitKeyMarkingListener(): void {
    this.configurationChangeDisposable?.dispose();

    this.configurationChangeDisposable = this.workspace.onDidChangeConfiguration(e => {
      if (this.suppressConfigFeedbackFromInboundPersistence) {
        return;
      }
      markExplicitLsKeysFromConfigurationChangeEvent(e, this.explicitLspConfigurationChangeTracker);
    });
  }

  private handleSnykConfigurationNotification(params: LspConfigurationParam): void {
    try {
      this.logger.debug('Received $/snyk.configuration notification');
      void this.runInboundPersistence(params);
    } catch (error) {
      this.logger.error(
        `Failed to handle $/snyk.configuration notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private runInboundPersistence(params: LspConfigurationParam): void {
    if (!this.persistInboundConfiguration) {
      return;
    }
    this.configPersistenceQueue = this.configPersistenceQueue
      .catch(() => {
        /* keep serialized queue alive if a prior step rejected unexpectedly */
      })
      .then(async () => {
        this.suppressConfigFeedbackFromInboundPersistence = true;
        try {
          await this.persistInboundConfiguration!(params);
        } catch (e) {
          this.logger.error(
            `Inbound LS configuration persistence failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        } finally {
          this.suppressConfigFeedbackFromInboundPersistence = false;
        }
      });
  }

  // Initialization options are not semantically equal to server settings, thus separated here
  // https://github.com/microsoft/language-server-protocol/issues/567
  async getInitializationOptions(): Promise<LspInitializationOptions> {
    const config = await LanguageServerSettings.fromConfiguration(
      this.configuration,
      lsKey => this.explicitLspConfigurationChangeTracker.isExplicitlyChanged(lsKey),
      this.workspace,
    );
    return {
      settings: config.settings ?? {},
      folderConfigs: config.folderConfigs,
      requiredProtocolVersion: `${PROTOCOL_VERSION}`,
      deviceId: this.user.anonymousId,
      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      hoverVerbosity: 1,
    };
  }

  showOutputChannel(): void {
    if (!this.client) {
      return;
    }

    this.client.outputChannel.show();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Snyk Language Server...');

    this.configurationChangeDisposable?.dispose();
    this.configurationChangeDisposable = undefined;

    if (!this.client) {
      return Promise.resolve();
    }

    if (this.client?.needsStop()) {
      await this.client.stop();
    }

    this.logger.info('Snyk Language Server stopped');
  }
}
