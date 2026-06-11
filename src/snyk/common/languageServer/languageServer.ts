import { execFile } from 'child_process';
import _ from 'lodash';
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs';
import { IAuthenticationService } from '../../base/services/authenticationService';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { SNYK_SETTINGS_COMMAND } from '../constants/commands';
import {
  DEVELOPMENT_PROTOCOL_VERSION,
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

  /**
   * Registers the (idempotent, session-long) listener that records user-driven `snyk.*`
   * settings changes for outbound `changed: true`. Call at activation so changes made
   * while the LS is down are still tracked. Returns the listener's {@link Disposable} on first
   * registration (so the caller can tie it to the extension lifetime), or `undefined` if already
   * registered.
   */
  registerExplicitKeyMarkingListener(): Disposable | undefined;

  showOutputChannel(): void;

  setWorkspaceConfigurationProvider(provider: IWorkspaceConfigurationWebviewProvider): void;

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

  setWorkspaceConfigurationProvider(provider: IWorkspaceConfigurationWebviewProvider): void {
    this.workspaceConfigurationProvider = provider;
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
    private readonly persistInboundConfiguration: (view: LspConfigurationParam) => Promise<void>,
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

    if (!(await this.verifyCliProtocolVersion(cliBinaryPath))) {
      return;
    }

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
   * Marks which LS keys the user explicitly changed via native VS Code settings, so the
   * middleware sets `changed: true` on the next `workspace/configuration` pull and on
   * `initializationOptions` at the next LS start.
   *
   * Registered once at extension activation — independently of the LS lifecycle — and kept
   * alive across restarts and while the LS is down. This is essential when the CLI hasn't
   * downloaded yet and the fallback settings page is shown: changes made then (e.g. unchecking
   * "manage binaries automatically") must still be recorded, otherwise the LS never learns the
   * override and echoes back its own default. Idempotent: subsequent calls are no-ops and return
   * `undefined`; the first call returns the listener's Disposable for the caller to own.
   */
  registerExplicitKeyMarkingListener(): Disposable | undefined {
    if (this.configurationChangeDisposable) {
      return undefined;
    }

    this.configurationChangeDisposable = this.workspace.onDidChangeConfiguration(e => {
      if (this.suppressConfigFeedbackFromInboundPersistence) {
        return;
      }
      markExplicitLsKeysFromConfigurationChangeEvent(e, this.explicitLspConfigurationChangeTracker);
    });
    return this.configurationChangeDisposable;
  }

  private handleSnykConfigurationNotification(params: LspConfigurationParam): void {
    this.logger.debug('Received $/snyk.configuration notification');
    this.runInboundPersistence(params);
    // Reflect inbound per-folder config changes (e.g. filter/delta toggles from the tree-view
    // toolbar) in an open settings window. The provider forwards the whole folderConfigs payload;
    // the webview applies the relevant controls silently, so it doesn't echo a change back (no loop)
    // and preserves any other in-progress edits.
    this.workspaceConfigurationProvider?.applyInboundFolderConfig(params.folderConfigs);
  }

  private runInboundPersistence(params: LspConfigurationParam): void {
    this.configPersistenceQueue = this.configPersistenceQueue
      .catch(() => {
        /* keep serialized queue alive if a prior step rejected unexpectedly */
      })
      .then(async () => {
        this.suppressConfigFeedbackFromInboundPersistence = true;
        try {
          await this.persistInboundConfiguration(params);
        } catch (e) {
          this.logger.error(
            `Inbound LS configuration persistence failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        } finally {
          this.suppressConfigFeedbackFromInboundPersistence = false;
        }
      });
  }

  /**
   * Probes the CLI's reported protocol version and aborts startup with a user-visible
   * error notification when it cannot be determined or doesn't match {@link PROTOCOL_VERSION}.
   * Does not trigger any download/repair: recovery is the user's choice via the action button.
   */
  private async verifyCliProtocolVersion(cliBinaryPath: string | undefined): Promise<boolean> {
    if (!cliBinaryPath) {
      await this.notifyProtocolVersionFailure(
        `Snyk CLI path is not configured. The Snyk Language Server will not start.`,
      );
      return false;
    }

    const cliProtocolVersion = await this.getCliProtocolVersion(cliBinaryPath);

    // Locally-built (non-release) snyk-ls binaries report the "development" sentinel and are
    // always compatible — mirror snyk-ls' own handleProtocolVersion behaviour so local
    // development binaries can start.
    if (cliProtocolVersion === DEVELOPMENT_PROTOCOL_VERSION) {
      this.logger.warn(
        `Snyk CLI reports a "${DEVELOPMENT_PROTOCOL_VERSION}" protocol version (local build); skipping the protocol version check.`,
      );
      return true;
    }

    if (cliProtocolVersion === PROTOCOL_VERSION) {
      return true;
    }

    const message =
      cliProtocolVersion === undefined
        ? `Failed to verify the Snyk CLI protocol version. Expected ${PROTOCOL_VERSION}. The Snyk Language Server will not start.`
        : `Snyk CLI protocol version mismatch (expected ${PROTOCOL_VERSION}, got ${cliProtocolVersion}). The Snyk Language Server will not start.`;
    await this.notifyProtocolVersionFailure(message);
    return false;
  }

  private async notifyProtocolVersionFailure(message: string): Promise<void> {
    this.logger.error(message);
    const openSettings = 'Open Settings';
    const choice = await this.window.showErrorMessage(message, openSettings);
    if (choice === openSettings) {
      await this.codeCommands.executeCommand(SNYK_SETTINGS_COMMAND);
    }
  }

  /**
   * Parses the trimmed `--protocolVersion` output into the {@link DEVELOPMENT_PROTOCOL_VERSION}
   * sentinel (local builds), a release integer, or `undefined` when it's neither.
   */
  protected parseProtocolVersionOutput(stdout: string): number | typeof DEVELOPMENT_PROTOCOL_VERSION | undefined {
    const trimmed = stdout.trim();
    if (trimmed === DEVELOPMENT_PROTOCOL_VERSION) {
      return DEVELOPMENT_PROTOCOL_VERSION;
    }
    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || `${parsed}` !== trimmed) {
      return undefined;
    }
    return parsed;
  }

  /**
   * Runs `<cliBinaryPath> language-server --protocolVersion` and parses the output.
   * Returns the {@link DEVELOPMENT_PROTOCOL_VERSION} sentinel for local builds that report it,
   * the parsed integer for release binaries, or `undefined` when the binary cannot be executed
   * or the output is neither the sentinel nor a parseable integer.
   *
   * Debug builds (`make build-debug`) pause ~10s and exit non-zero after printing the version, so we
   * parse stdout even when execFile reports an error and only treat it as a failure when no valid
   * version was printed.
   */
  protected getCliProtocolVersion(
    cliBinaryPath: string,
  ): Promise<number | typeof DEVELOPMENT_PROTOCOL_VERSION | undefined> {
    return new Promise(resolve => {
      execFile(cliBinaryPath, ['language-server', '--protocolVersion'], (error, stdout, stderr) => {
        const version = this.parseProtocolVersionOutput(stdout ?? '');

        if (version !== undefined) {
          if (error) {
            this.logger.warn(
              `Snyk CLI protocol version probe exited with an error but reported a version ("${version}"); using it. ` +
                `Error: ${error.message}`,
            );
          }
          resolve(version);
          return;
        }

        if (error) {
          const { code, signal } = error as NodeJS.ErrnoException & { signal?: NodeJS.Signals };
          this.logger.error(
            `Failed to invoke Snyk CLI for protocol version probe (exit code: ${code ?? 'n/a'}, signal: ${
              signal ?? 'n/a'
            }): ${error.message}. stdout: "${(stdout ?? '').trim()}", stderr: "${(stderr ?? '').trim()}"`,
          );
          resolve(undefined);
          return;
        }

        this.logger.error(`Unable to parse Snyk CLI protocol version output: "${(stdout ?? '').trim()}"`);
        resolve(undefined);
      });
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

    // Intentionally keep `configurationChangeDisposable` alive across stop/restart and while the LS
    // is down — see registerExplicitKeyMarkingListener. Its lifetime is owned by the extension
    // context (registered into subscriptions at activation), so it's disposed on deactivation.

    if (!this.client) {
      return Promise.resolve();
    }

    if (this.client?.needsStop()) {
      await this.client.stop();
    }

    this.logger.info('Snyk Language Server stopped');
  }
}
