import _ from 'lodash';
import { firstValueFrom, ReplaySubject, Subject, Subscription, switchMap } from 'rxjs';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { FolderConfig, IConfiguration } from '../configuration/configuration';
import { DEFAULT_LS_DEBOUNCE_INTERVAL } from '../constants/general';
import {
  DID_CHANGE_CONFIGURATION_METHOD,
  SNYK_ADD_TRUSTED_FOLDERS,
  SNYK_CONFIGURATION,
  SNYK_REGISTER_MCP,
  SNYK_FOLDERCONFIG,
  SNYK_HAS_AUTHENTICATED,
  SNYK_LANGUAGE_SERVER_NAME,
  SNYK_SCAN,
  SNYK_SCANSUMMARY,
  SNYK_TREEVIEW,
} from '../constants/languageServer';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { DownloadService } from '../services/downloadService';
import { User } from '../user';
import { ILanguageClientAdapter } from '../vscode/languageClient';
import { Disposable, LanguageClient, LanguageClientOptions, ServerOptions } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { mergeInboundLspConfiguration, type MergedLspConfigurationView } from './lspConfigurationMerge';
import { LanguageClientMiddleware } from './middleware';
import { markExplicitPflagsFromConfigurationChangeEvent } from './configurationChangeToExplicitPflags';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import { serverSettingsToLspConfigurationParam } from './serverSettingsToLspConfigurationParam';
import { LanguageServerSettings, ServerSettings } from './settings';
import { LspConfigurationParam, Scan, ShowIssueDetailTopicParams } from './types';
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

  setInboundConfigurationPersistenceHandler(handler: (view: MergedLspConfigurationView) => Promise<void>): void;

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
  public static ReceivedFolderConfigsFromLs = false;
  // Track folder paths where LS is updating org settings to prevent circular updates
  private static foldersBeingUpdatedByLS = new Set<string>();
  private workspaceConfigurationProvider?: IWorkspaceConfigurationWebviewProvider;
  private folderConfig$ = new Subject<{
    type: string;
    processor: () => Promise<void>;
  }>();
  private folderConfigSubscription?: Subscription;
  private inboundLspConfiguration: MergedLspConfigurationView = {
    globalSettings: {},
    folderSettingsByPath: {},
  };
  private configurationChangeDisposable?: Disposable;
  private debouncedPushStructuredConfiguration?: _.DebouncedFunc<() => void>;
  /** When true, VS Code `settings.json` updates from inbound LS persistence must not trigger outbound `didChangeConfiguration`. */
  private suppressStructuredConfigPushFromInboundPersistence = false;
  /** Serializes disk persistence so concurrent `$/snyk.configuration` handlers do not interleave writes. */
  private inboundPersistenceChain: Promise<void> = Promise.resolve();
  private persistInboundConfiguration?: (view: MergedLspConfigurationView) => Promise<void>;

  static isLSUpdatingOrg(folderPath: string): boolean {
    return LanguageServer.foldersBeingUpdatedByLS.has(folderPath);
  }

  /**
   * Should only be needed by tests.
   */
  static clearLSUpdatingOrgState(): void {
    LanguageServer.foldersBeingUpdatedByLS.clear();
  }

  /**
   * @internal Tests — simulate `foldersBeingUpdatedByLS` while LS applies org from `$/snyk.folderConfigs`.
   */
  static beginLSOrgUpdateFromFolderConfigsForTests(folderPath: string): void {
    LanguageServer.foldersBeingUpdatedByLS.add(folderPath);
  }

  /**
   * @internal Tests — end simulated org update for one folder.
   */
  static endLSOrgUpdateFromFolderConfigsForTests(folderPath: string): void {
    LanguageServer.foldersBeingUpdatedByLS.delete(folderPath);
  }

  setWorkspaceConfigurationProvider(provider: IWorkspaceConfigurationWebviewProvider): void {
    this.workspaceConfigurationProvider = provider;
  }

  /**
   * Persists each inbound `$/snyk.configuration` global snapshot into VS Code settings
   * (see {@link ConfigurationPersistenceService.persistInboundLspConfiguration}).
   */
  setInboundConfigurationPersistenceHandler(handler: (view: MergedLspConfigurationView) => Promise<void>): void {
    this.persistInboundConfiguration = handler;
  }

  /** Latest merged view from `$/snyk.configuration` (for UI and tests). */
  getInboundLspConfigurationView(): MergedLspConfigurationView {
    return this.inboundLspConfiguration;
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

    // Set up folder config processing pipeline with switchMap to take latest and cancel previous
    this.folderConfigSubscription = this.folderConfig$
      .pipe(
        switchMap(({ type, processor }) =>
          processor()
            .then(() => {
              this.logger.debug(`Completed folder config processing for type: ${type}`);
            })
            .catch(error => {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`Error processing folder config ${type}: ${errorMessage}`);
            }),
        ),
      )
      .subscribe();

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
      initializationOptions: await this.getInitializationOptions(),
      // Do not set synchronize.configurationSection: it makes vscode-languageclient send
      // workspace/didChangeConfiguration with a flat VS Code `snyk` object. snyk-ls expects
      // DidChangeConfigurationParams.settings to deserialize as LspConfigurationParam (pflag maps).
      // Structured outbound is sent explicitly; see docs/configuration-gaf-ls-ide-flow.md.
      // Keep synchronize as {} so we opt into no automatic config sync by construction, instead of
      // omitting the field and depending on vscode-languageclient defaults (which could change).
      synchronize: {},
      middleware: new LanguageClientMiddleware(
        this.logger,
        this.configuration,
        this.user,
        this.showIssueDetailTopic$,
        this.uriAdapter,
        this.codeCommands,
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
      this.registerStructuredConfigurationChangeListener(this.client);
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
            this.registerStructuredConfigurationChangeListener(this.client);
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

    client.onNotification(SNYK_FOLDERCONFIG, ({ folderConfigs }: { folderConfigs: FolderConfig[] }) => {
      // Send to folder config stream (uses switchMap to take latest and cancel previous)
      this.folderConfig$.next({
        type: SNYK_FOLDERCONFIG,
        processor: async () => {
          // Process each folder config: merge on first receipt, handle org settings on subsequent receipts
          let didFolderConfigMergeHappen = false;
          const processedFolderConfigs = folderConfigs.map(folderConfig => {
            const isFirstReceipt = !this.configuration
              .getFolderConfigs()
              .find(cachedFC => cachedFC.folderPath === folderConfig.folderPath);
            if (isFirstReceipt) {
              // First time receiving config for this folder - merge VS Code settings into LS config
              didFolderConfigMergeHappen = true;
              return this.mergeOrgSettingsIntoLSFolderConfig(folderConfig);
            }

            // Subsequent receipt - return as-is (will be handled by handleOrgSettingsFromFolderConfigs)
            return folderConfig;
          });

          // Update org settings in VS Code UI to reflect the current state
          await this.handleOrgSettingsFromFolderConfigs(processedFolderConfigs);

          // Set global flag after first folder config received (used for initialization options)
          LanguageServer.ReceivedFolderConfigsFromLs = true;

          // Save folder configs
          await this.configuration.setFolderConfigs(processedFolderConfigs, didFolderConfigMergeHappen);
        },
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

  private registerStructuredConfigurationChangeListener(client: LanguageClient): void {
    this.configurationChangeDisposable?.dispose();
    this.debouncedPushStructuredConfiguration?.cancel();

    this.debouncedPushStructuredConfiguration = _.debounce(() => {
      void this.pushStructuredConfigurationToLanguageServer(client);
    }, DEFAULT_LS_DEBOUNCE_INTERVAL);

    this.configurationChangeDisposable = this.workspace.onDidChangeConfiguration(e => {
      // `snyk.*` is obvious; also watch `http.*` because proxy/TLS settings live there (not under `snyk`)
      // and still flow into outbound LS settings (e.g. insecure / cli behavior via IConfiguration).
      if (!e.affectsConfiguration('snyk') && !e.affectsConfiguration('http')) {
        return;
      }
      if (LanguageServer.foldersBeingUpdatedByLS.size > 0) {
        return;
      }
      if (this.suppressStructuredConfigPushFromInboundPersistence) {
        return;
      }
      markExplicitPflagsFromConfigurationChangeEvent(e, this.explicitLspConfigurationChangeTracker);
      this.debouncedPushStructuredConfiguration?.();
    });
  }

  private async pushStructuredConfigurationToLanguageServer(client: LanguageClient): Promise<void> {
    try {
      const serverSettings = await LanguageServerSettings.fromConfiguration(this.configuration, this.user);
      const param = serverSettingsToLspConfigurationParam(serverSettings, pflagKey =>
        this.explicitLspConfigurationChangeTracker.isExplicitlyChanged(pflagKey),
      );
      await client.sendNotification(DID_CHANGE_CONFIGURATION_METHOD, { settings: param });
    } catch (error) {
      this.logger.error(
        `Failed to send structured workspace/didChangeConfiguration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private handleSnykConfigurationNotification(params: LspConfigurationParam): void {
    this.inboundLspConfiguration = mergeInboundLspConfiguration(params);
    this.logger.debug('Received $/snyk.configuration notification');
    void this.authenticationService.syncLoggedInContextFromStoredTokenIfValid();
    void this.runInboundPersistenceIfConfigured();
    this.scheduleInboundConfigurationNotificationToWorkspace();
  }

  private runInboundPersistenceIfConfigured(): void {
    if (!this.persistInboundConfiguration) {
      return;
    }
    this.inboundPersistenceChain = this.inboundPersistenceChain
      .catch(() => {
        /* keep serialized queue alive if a prior step rejected unexpectedly */
      })
      .then(async () => {
        this.suppressStructuredConfigPushFromInboundPersistence = true;
        try {
          await this.persistInboundConfiguration!(this.inboundLspConfiguration);
        } catch (e) {
          this.logger.error(
            `Inbound LS configuration persistence failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        } finally {
          this.suppressStructuredConfigPushFromInboundPersistence = false;
        }
      });
  }

  /**
   * Pushes merged inbound config to the workspace configuration UI when LS is not in the middle of
   * applying org settings from `$/snyk.folderConfigs` (see `foldersBeingUpdatedByLS`).
   */
  private scheduleInboundConfigurationNotificationToWorkspace(): void {
    const provider = this.workspaceConfigurationProvider;
    if (!provider?.onInboundLspConfigurationUpdated) {
      return;
    }
    if (LanguageServer.foldersBeingUpdatedByLS.size > 0) {
      queueMicrotask(() => this.scheduleInboundConfigurationNotificationToWorkspace());
      return;
    }
    provider.onInboundLspConfigurationUpdated(this.inboundLspConfiguration);
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

  private async handleOrgSettingsFromFolderConfigs(folderConfigs: FolderConfig[]): Promise<void> {
    const currentWorkspaceFolders = this.workspace.getWorkspaceFolders();

    // Process folder configs sequentially to avoid race conditions
    // eslint-disable-next-line no-await-in-loop
    for (const folderConfig of folderConfigs) {
      // Only write folder level org settings for folders that have been migrated from global config
      if (!folderConfig.orgMigratedFromGlobalConfig) {
        continue;
      }

      // Only set organization for folders that are part of the current VS Code workspace
      const workspaceFolder = currentWorkspaceFolders.find(
        workspaceFolder => folderConfig.folderPath === workspaceFolder.uri.fsPath,
      );

      if (!workspaceFolder) {
        this.logger.warn(`No workspace folder found for path: ${folderConfig.folderPath}`);
        continue;
      }

      const orgToDisplay = folderConfig.orgSetByUser ? folderConfig.preferredOrg : folderConfig.autoDeterminedOrg;

      // Mark this folder as being updated by LS to prevent circular updates in the watcher
      LanguageServer.foldersBeingUpdatedByLS.add(folderConfig.folderPath);

      try {
        // eslint-disable-next-line no-await-in-loop
        await this.configuration.setOrganization(workspaceFolder, orgToDisplay);
        this.logger.debug(
          `Set organization "${orgToDisplay}" for workspace folder: ${folderConfig.folderPath} (orgSetByUser: ${folderConfig.orgSetByUser})`,
        );
      } catch (error) {
        this.logger.warn(`Failed to set organization for folder ${folderConfig.folderPath}: ${error}`);
      }
      // Set auto-organization at workspace folder level only if the desired value differs from
      // the current configuration value when querying all levels (folder, workspace, global, default).
      // Unless the desired auto-org is true (selected), then it should be written at the folder level.
      const desiredAutoOrg = !folderConfig.orgSetByUser;
      const currentAutoOrg = this.configuration.isAutoSelectOrganizationEnabled(workspaceFolder);

      try {
        if (desiredAutoOrg !== currentAutoOrg || desiredAutoOrg) {
          // eslint-disable-next-line no-await-in-loop
          await this.configuration.setAutoSelectOrganization(workspaceFolder, desiredAutoOrg);
          this.logger.debug(
            `Set auto-organization to ${desiredAutoOrg} for workspace folder: ${folderConfig.folderPath}`,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to set auto-organization for folder ${folderConfig.folderPath}: ${error}`);
      }
      // Clear the flag after update completes (whether success or error)
      LanguageServer.foldersBeingUpdatedByLS.delete(folderConfig.folderPath);
    }
  }

  private mergeOrgSettingsIntoLSFolderConfig(folderConfig: FolderConfig): FolderConfig {
    const workspaceFolder = this.workspace.getWorkspaceFolder(folderConfig.folderPath);
    if (!workspaceFolder) {
      // LS must be crazy, we don't know of this folder, so we will just store it as-is.
      return folderConfig;
    }

    const orgSetByUser = !this.configuration.isAutoSelectOrganizationEnabled(workspaceFolder);
    if (orgSetByUser) {
      return {
        ...folderConfig,
        preferredOrg: this.configuration.getOrganizationAtWorkspaceFolderLevel(workspaceFolder) ?? '',
        orgSetByUser: true,
      };
    } else {
      return {
        ...folderConfig,
        orgSetByUser: false,
      };
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Snyk Language Server...');

    this.configurationChangeDisposable?.dispose();
    this.configurationChangeDisposable = undefined;
    this.debouncedPushStructuredConfiguration?.cancel();
    this.debouncedPushStructuredConfiguration = undefined;

    // Complete the folder config stream and unsubscribe to prevent new notifications from being processed
    this.folderConfig$.complete();
    this.folderConfigSubscription?.unsubscribe();

    if (!this.client) {
      return Promise.resolve();
    }

    if (this.client?.needsStop()) {
      await this.client.stop();
    }

    this.logger.info('Snyk Language Server stopped');
  }
}
