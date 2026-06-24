import assert, { deepStrictEqual, strictEqual } from 'assert';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { v4 } from 'uuid';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { LanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { LS_GLOBAL_KEY, LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { User } from '../../../../snyk/common/user';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMock, LoggerMockFailOnErrors } from '../../mocks/logger.mock';
import { WindowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import { PROTOCOL_VERSION } from '../../../../snyk/common/constants/languageServer';
import { IExtensionRetriever } from '../../../../snyk/common/vscode/extensionContext';
import { ISummaryProviderService } from '../../../../snyk/base/summary/summaryProviderService';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { IMarkdownStringAdapter } from '../../../../snyk/common/vscode/markdownString';
import { CommandsMock } from '../../mocks/commands.mock';
import { IDiagnosticsIssueProvider } from '../../../../snyk/common/services/diagnosticsService';
import { IMcpProvider } from '../../../../snyk/common/vscode/mcpProvider';
import { ITreeViewProviderService } from '../../../../snyk/base/treeView/treeViewProviderService';
import { IWorkspaceConfigurationWebviewProvider } from '../../../../snyk/common/views/workspaceConfiguration/types/workspaceConfiguration.types';
import type { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { ExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { ConfigFeedbackSuppressor } from '../../../../snyk/common/languageServer/configFeedbackSuppressor';

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;
  let protocolVersionStub: sinon.SinonStub;

  const logger = new LoggerMockFailOnErrors();

  const explicitLspConfigurationChangeTracker: IExplicitLspConfigurationChangeTracker = {
    markExplicitlyChanged: sinon.stub(),
    unmarkExplicitlyChanged: sinon.stub(),
    isExplicitlyChanged: () => true,
    markPendingReset: sinon.stub(),
    consumePendingResets: sinon.stub().returns(new Set<string>()),
  };

  const createFakeLanguageServer = (
    languageClientAdapter: ILanguageClientAdapter,
    workspace: IVSCodeWorkspace,
    treeViewProvider?: ITreeViewProviderService,
  ) => {
    return new LanguageServer(
      user,
      configurationMock,
      languageClientAdapter,
      workspace,
      new WindowMock(),
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      new CommandsMock(),
      {} as IDiagnosticsIssueProvider<unknown>,
      explicitLspConfigurationChangeTracker,
      sinon.stub().resolves(),
      treeViewProvider,
      new ConfigFeedbackSuppressor(),
    );
  };

  type LspNotificationHandler = (params: unknown) => void;

  function createRecordingLanguageClientAdapter(): {
    notificationHandlers: Record<string, LspNotificationHandler>;
    sendNotification: sinon.SinonStub;
    adapter: ILanguageClientAdapter;
  } {
    const notificationHandlers: Record<string, LspNotificationHandler> = {};
    const sendNotification = sinon.stub().resolves();
    const adapter = {
      create(): LanguageClient {
        return {
          start: sinon.stub().resolves(),
          onNotification(method: string, handler: LspNotificationHandler): void {
            notificationHandlers[method] = handler;
          },
          onReady: sinon.stub().resolves(),
          sendNotification,
        } as unknown as LanguageClient;
      },
    } as unknown as ILanguageClientAdapter;
    return { notificationHandlers, sendNotification, adapter };
  }

  async function startLanguageServerWithRecordingClient(options?: {
    treeViewProvider?: ITreeViewProviderService;
    workspaceConfigurationProvider?: IWorkspaceConfigurationWebviewProvider;
  }): Promise<{ notificationHandlers: Record<string, LspNotificationHandler> }> {
    const { notificationHandlers, adapter } = createRecordingLanguageClientAdapter();
    languageServer = createFakeLanguageServer(
      adapter,
      stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
      options?.treeViewProvider,
    );
    if (options?.workspaceConfigurationProvider) {
      languageServer.setWorkspaceConfigurationProvider(options.workspaceConfigurationProvider);
    }
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    return { notificationHandlers };
  }

  setup(() => {
    configurationMock = {
      getAuthenticationMethod(): string {
        return 'oauth';
      },
      getInsecure(): boolean {
        return true;
      },
      getDeltaFindingsEnabled(): boolean {
        return false;
      },
      getCliPath(): Promise<string | undefined> {
        return Promise.resolve('testPath');
      },
      getCliBaseDownloadUrl(): string {
        return 'https://downloads.snyk.io';
      },
      getToken(): Promise<string | undefined> {
        return Promise.resolve('testToken');
      },
      shouldReportErrors: true,
      getAdditionalCliParameters() {
        return '--all-projects -d';
      },
      isAutomaticDependencyManagementEnabled() {
        return true;
      },
      getFeaturesConfiguration() {
        return defaultFeaturesConfigurationStub;
      },
      getPreviewFeatures() {
        return {};
      },
      getOssQuickFixCodeActionsEnabled(): boolean {
        return true;
      },
      severityFilter: DEFAULT_SEVERITY_FILTER,
      riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
      issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
      getTrustedFolders(): string[] {
        return ['/trusted/test/folder'];
      },
      getFolderConfigs(): FolderConfig[] {
        return [];
      },
      scanningMode: 'auto',
      getSecureAtInceptionExecutionFrequency(): string {
        return 'Manual';
      },
      getAutoConfigureMcpServer(): boolean {
        return false;
      },
    } as IConfiguration;

    downloadServiceMock = {
      downloadReady$: new ReplaySubject<void>(1),
      verifyAndRepairCli: sinon.fake.resolves(true),
    } as unknown as DownloadService;

    // Stub the protocol-version probe to a matching version so existing tests can start the LS.
    protocolVersionStub = sinon
      .stub(LanguageServer.prototype, 'getCliProtocolVersion' as keyof LanguageServer)
      .resolves(PROTOCOL_VERSION);
  });

  teardown(() => {
    sinon.restore();
  });

  test('LanguageServer starts with correct args', async () => {
    const lca = sinon.spy({
      create(
        _id: string,
        _name: string,
        serverOptions: ServerOptions,
        _clientOptions: LanguageClientOptions,
      ): LanguageClient {
        return {
          start(): Promise<void> {
            assert.strictEqual('args' in serverOptions ? serverOptions?.args?.[0] : '', 'language-server');
            assert.strictEqual('args' in serverOptions ? serverOptions?.args?.[1] : '', '-l');
            assert.strictEqual('args' in serverOptions ? serverOptions?.args?.[2] : '', 'debug');
            return Promise.resolve();
          },
          onNotification(): void {
            return;
          },
          onReady(): Promise<void> {
            return Promise.resolve();
          },
          sendNotification: sinon.stub().resolves(),
        } as unknown as LanguageClient;
      },
    });

    languageServer = createFakeLanguageServer(
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
    );
    downloadServiceMock.downloadReady$.next();

    await languageServer.start();
    sinon.assert.called(lca.create);
  });

  test('LanguageServer adds proxy settings to env of started binary', async () => {
    const expectedProxy = 'http://localhost:8080';
    const lca = sinon.spy({
      create(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
      ): LanguageClient {
        return {
          start(): Promise<void> {
            assert.strictEqual(id, 'SnykLS');
            assert.strictEqual(name, 'Snyk Language Server');
            assert.strictEqual(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              'options' in serverOptions ? serverOptions?.options?.env?.HTTP_PROXY : undefined,
              expectedProxy,
            );
            assert.strictEqual(
              (clientOptions.initializationOptions as { settings?: Record<string, { value?: unknown }> }).settings?.[
                LS_KEY.token
              ]?.value,
              'testToken',
            );
            return Promise.resolve();
          },
          onNotification(): void {
            return;
          },
          onReady(): Promise<void> {
            return Promise.resolve();
          },
          sendNotification: sinon.stub().resolves(),
        } as unknown as LanguageClient;
      },
    });

    languageServer = createFakeLanguageServer(
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', expectedProxy),
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    sinon.assert.called(lca.create);
  });

  test('marks explicit LS keys when snyk settings change', async () => {
    const markStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: markStub,
      unmarkExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: () => true,
      markPendingReset: sinon.stub(),
      consumePendingResets: sinon.stub().returns(new Set<string>()),
    };
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const adapter = {
      create(): LanguageClient {
        return {
          start: sinon.stub().resolves(),
          onNotification(): void {
            return;
          },
          onReady: sinon.stub().resolves(),
          sendNotification: sinon.stub().resolves(),
        } as unknown as LanguageClient;
      },
    } as unknown as ILanguageClientAdapter;

    const baseWorkspace = stubWorkspaceConfiguration('snyk.loglevel', 'trace');
    const workspace = {
      ...baseWorkspace,
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
    } as IVSCodeWorkspace;

    languageServer = new LanguageServer(
      user,
      configurationMock,
      adapter,
      workspace,
      new WindowMock(),
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      new CommandsMock(),
      {} as IDiagnosticsIssueProvider<unknown>,
      tracker,
      sinon.stub().resolves(),
      undefined,
      new ConfigFeedbackSuppressor(),
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });
    sinon.assert.called(markStub);
  });

  test('does not mark explicit LS keys when only non-snyk configuration changes', async () => {
    const markStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: markStub,
      unmarkExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: () => true,
      markPendingReset: sinon.stub(),
      consumePendingResets: sinon.stub().returns(new Set<string>()),
    };
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const adapter = {
      create(): LanguageClient {
        return {
          start: sinon.stub().resolves(),
          onNotification(): void {
            return;
          },
          onReady: sinon.stub().resolves(),
          sendNotification: sinon.stub().resolves(),
        } as unknown as LanguageClient;
      },
    } as unknown as ILanguageClientAdapter;

    const baseWorkspace = stubWorkspaceConfiguration('snyk.loglevel', 'trace');
    const workspace = {
      ...baseWorkspace,
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
    } as IVSCodeWorkspace;

    languageServer = new LanguageServer(
      user,
      configurationMock,
      adapter,
      workspace,
      new WindowMock(),
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      new CommandsMock(),
      {} as IDiagnosticsIssueProvider<unknown>,
      tracker,
      sinon.stub().resolves(),
      undefined,
      new ConfigFeedbackSuppressor(),
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    configListener({ affectsConfiguration: () => false });
    sinon.assert.notCalled(markStub);
  });

  test('tracks explicit LS keys while the LS is down (listener registered without start)', () => {
    const markStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: markStub,
      unmarkExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: () => true,
      markPendingReset: sinon.stub(),
      consumePendingResets: sinon.stub().returns(new Set<string>()),
    };
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const onDidChangeConfigurationStub = sinon.stub().callsFake((fn: typeof configListener) => {
      configListener = fn;
      return { dispose: sinon.stub() };
    });
    const createStub = sinon.stub();
    const adapter = { create: createStub } as unknown as ILanguageClientAdapter;

    const workspace = {
      ...stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
      onDidChangeConfiguration: onDidChangeConfigurationStub,
    } as IVSCodeWorkspace;

    languageServer = new LanguageServer(
      user,
      configurationMock,
      adapter,
      workspace,
      new WindowMock(),
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      new CommandsMock(),
      {} as IDiagnosticsIssueProvider<unknown>,
      tracker,
      sinon.stub().resolves(),
      undefined,
      new ConfigFeedbackSuppressor(),
    );

    // No start() — the CLI hasn't downloaded yet, but the listener must already be active.
    languageServer.registerExplicitKeyMarkingListener();
    // Idempotent: a second call must not subscribe again.
    languageServer.registerExplicitKeyMarkingListener();

    configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

    sinon.assert.calledOnce(onDidChangeConfigurationStub);
    sinon.assert.called(markStub);
    sinon.assert.notCalled(createStub);
  });

  suite('parseProtocolVersionOutput', () => {
    let parse: (stdout: string) => number | 'development' | undefined;

    setup(() => {
      const ls = createFakeLanguageServer(
        { create: sinon.stub() } as unknown as ILanguageClientAdapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
      );
      parse = (stdout: string) =>
        (
          ls as unknown as {
            parseProtocolVersionOutput(s: string): number | 'development' | undefined;
          }
        ).parseProtocolVersionOutput(stdout);
    });

    test('parses a plain integer version', () => {
      strictEqual(parse('25'), 25);
    });

    test('trims surrounding whitespace and newlines', () => {
      strictEqual(parse('  25\n'), 25);
    });

    test('returns the development sentinel for local builds', () => {
      strictEqual(parse('development'), 'development');
    });

    test('returns undefined for empty output', () => {
      strictEqual(parse(''), undefined);
    });

    test('returns undefined for non-numeric output (e.g. CLI help text)', () => {
      strictEqual(parse('CLI help\n  snyk auth\n  snyk test'), undefined);
    });

    test('returns undefined for partially-numeric output', () => {
      strictEqual(parse('25abc'), undefined);
      strictEqual(parse('v25'), undefined);
    });
  });

  suite('LanguageServer is initialized', () => {
    setup(() => {
      const mockLanguageClient = {
        start: sinon.stub().resolves(),
      };
      const mockLanguageClientAdapter = {
        create: sinon.stub().returns(mockLanguageClient),
        getLanguageClient: sinon.stub().returns(mockLanguageClient),
      };
      languageServer = createFakeLanguageServer(mockLanguageClientAdapter, {} as IVSCodeWorkspace);
    });

    const tcs: {
      name: string;
      folderConfigs: FolderConfig[];
    }[] = [
      {
        name: 'LanguageServer should provide empty folder configs when in-memory folder configs are empty',
        folderConfigs: [],
      },
      {
        name: 'LanguageServer should include folder configs from configuration when non-empty',
        folderConfigs: [
          new FolderConfig('/test/path', {
            base_branch: { value: 'main', changed: true },
            local_branches: { value: ['main', 'develop'], changed: true },
            preferred_org: { value: 'irrelevant-org', changed: true },
            org_set_by_user: { value: true, changed: true },
            auto_determined_org: { value: 'irrelevant-org', changed: true },
          }),
        ],
      },
    ];
    tcs.forEach(tc => {
      test(tc.name, async () => {
        configurationMock.getFolderConfigs = () => tc.folderConfigs;

        const initializationOptions = await languageServer.getInitializationOptions();

        // Init metadata
        strictEqual(initializationOptions.deviceId, user.anonymousId);
        strictEqual(initializationOptions.integrationName, 'VS_CODE');
        strictEqual(initializationOptions.requiredProtocolVersion, PROTOCOL_VERSION.toString());
        strictEqual(initializationOptions.hoverVerbosity, 1);
        deepStrictEqual(initializationOptions.settings[LS_KEY.trustedFolders]?.value, ['/trusted/test/folder']);

        // Settings
        strictEqual(initializationOptions.settings[LS_KEY.snykCodeEnabled]?.value, true);
        strictEqual(initializationOptions.settings[LS_KEY.snykOssEnabled]?.value, false);
        strictEqual(initializationOptions.settings[LS_KEY.snykIacEnabled]?.value, true);
        strictEqual(initializationOptions.settings[LS_KEY.snykSecretsEnabled]?.value, false);
        strictEqual(initializationOptions.settings[LS_KEY.token]?.value, 'testToken');
        strictEqual(initializationOptions.settings[LS_KEY.cliPath]?.value, 'testPath');
        strictEqual(initializationOptions.settings[LS_KEY.sendErrorReports]?.value, true);
        strictEqual(initializationOptions.settings[LS_KEY.scanAutomatic]?.value, true);

        // Folder configs
        if (tc.folderConfigs.length > 0) {
          assert.ok(initializationOptions.folderConfigs);
          strictEqual(initializationOptions.folderConfigs?.length, tc.folderConfigs.length);
        }
      });
    });

    test('LanguageServer should respect experiment setup for Code', async () => {
      const initOptions = await languageServer.getInitializationOptions();

      strictEqual(initOptions.settings[LS_KEY.snykCodeEnabled]?.value, true);
    });

    ['auto', 'manual'].forEach(expectedScanningMode => {
      test(`scanningMode is set to ${expectedScanningMode}`, async () => {
        configurationMock.scanningMode = expectedScanningMode;
        const options = await languageServer.getInitializationOptions();

        assert.strictEqual(options.settings[LS_KEY.scanAutomatic]?.value, expectedScanningMode !== 'manual');
      });
    });

    // Fix 2: pending resets queued before LS (re)start are emitted as {value:null, changed:true}
    // in initializationOptions, so a reset is not lost when the LS restarts.
    test('getInitializationOptions emits {value:null,changed:true} for a pending-reset key', async () => {
      // Build a tracker that has one pending reset (organization).
      const consumePendingResetsStub = sinon.stub().returns(new Set<string>([LS_GLOBAL_KEY.organization]));
      const pendingResetTracker: IExplicitLspConfigurationChangeTracker = {
        markExplicitlyChanged: sinon.stub(),
        unmarkExplicitlyChanged: sinon.stub(),
        isExplicitlyChanged: () => false,
        markPendingReset: sinon.stub(),
        consumePendingResets: consumePendingResetsStub,
      };

      const mockLanguageClientAdapter = {
        create: sinon.stub().returns({ start: sinon.stub().resolves() }),
        getLanguageClient: sinon.stub().returns({ start: sinon.stub().resolves() }),
      };

      const ls = new LanguageServer(
        user,
        configurationMock,
        mockLanguageClientAdapter,
        {} as IVSCodeWorkspace,
        new WindowMock(),
        authServiceMock,
        logger,
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        pendingResetTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );

      const options = await ls.getInitializationOptions();

      // The pending-reset key must emit {value:null, changed:true}.
      strictEqual(options.settings[LS_GLOBAL_KEY.organization]?.value, null);
      strictEqual(options.settings[LS_GLOBAL_KEY.organization]?.changed, true);

      // consumePendingResets must have been called exactly once (so the reset is delivered).
      sinon.assert.calledOnce(consumePendingResetsStub);
    });
  });

  suite('treeView notification', () => {
    test('should forward treeView notification to treeViewProvider', async () => {
      const updateStub = sinon.stub();
      const treeViewProviderMock: ITreeViewProviderService = {
        updateTreeViewPanel: updateStub,
      };

      const { notificationHandlers } = await startLanguageServerWithRecordingClient({
        treeViewProvider: treeViewProviderMock,
      });

      const handler = notificationHandlers['$/snyk.treeView'];
      assert(handler, 'treeView notification handler should be registered');

      handler({ treeViewHtml: '<html>tree</html>' });

      sinon.assert.calledOnce(updateStub);
      sinon.assert.calledWith(updateStub, '<html>tree</html>');
    });

    test('should not fail when treeViewProvider is undefined', async () => {
      const { notificationHandlers } = await startLanguageServerWithRecordingClient();

      const handler = notificationHandlers['$/snyk.treeView'];
      assert(handler, 'treeView notification handler should be registered');

      // Should not throw when provider is undefined
      handler({ treeViewHtml: '<html>tree</html>' });
    });
  });

  suite('snyk.configuration notification', () => {
    test('should register handler and handle payload', async () => {
      const debugSpy = sinon.spy(logger, 'debug');

      const { notificationHandlers } = await startLanguageServerWithRecordingClient();

      const handler = notificationHandlers['$/snyk.configuration'];
      assert(handler, 'snyk.configuration notification handler should be registered');

      const endpointKey = 'endpoint';
      handler({
        settings: {
          [endpointKey]: {
            value: 'https://api.dev.snyk.io',
            source: 'default',
            isLocked: false,
          },
        },
      });

      sinon.assert.calledOnceWithExactly(debugSpy, 'Received $/snyk.configuration notification');
      debugSpy.restore();
    });
  });

  // ── CLAIM 1: outbound reset self-cancel timing fix (IDE-2149) ───────────────
  //
  // The round-5 fix made markExplicitlyChanged call pendingResets.delete so that a
  // user re-edit after a reset cancels the stale pending signal.  But the
  // onDidChangeConfiguration listener (registered in registerExplicitKeyMarkingListener)
  // also calls markExplicitlyChanged for ANY snyk.* setting change — including the change
  // triggered by the reset's own updateConfiguration write.
  //
  // Adversarial ordering:
  //   1. applyOutboundGlobalResets calls updateConfiguration (clears VS Code override)
  //   2. markPendingReset(key) — key is now in pendingResets
  //   3. VS Code fires onDidChangeConfiguration (asynchronously, after step 2)
  //   4. listener calls markExplicitlyChanged(key) → pendingResets.delete(key) → LOST
  //
  // The fix: suppress the listener while the outbound reset write is in flight by
  // checking outboundResetSuppressor.isActive in the listener.
  suite('outbound reset self-cancel guard (Claim 1 — adversarial onDidChangeConfiguration ordering)', () => {
    /** Minimal in-memory Memento for ExplicitLspConfigurationChangeTracker. */
    function makeMemento(): import('vscode').Memento {
      const store = new Map<string, unknown>();
      return {
        get<T>(key: string, defaultValue?: T): T {
          return (store.has(key) ? store.get(key) : defaultValue) as T;
        },
        update(key: string, value: unknown): Thenable<void> {
          store.set(key, value);
          return Promise.resolve();
        },
        keys(): readonly string[] {
          return [...store.keys()];
        },
      };
    }

    function makeLanguageServerWithListener(
      tracker: ExplicitLspConfigurationChangeTracker,
      suppressor: ConfigFeedbackSuppressor,
      onListener: (fn: (e: { affectsConfiguration: (s: string) => boolean }) => void) => void,
    ): LanguageServer {
      const adapter = {
        create(): LanguageClient {
          return {
            start: sinon.stub().resolves(),
            onNotification(): void {
              return;
            },
            onReady: sinon.stub().resolves(),
            sendNotification: sinon.stub().resolves(),
          } as unknown as LanguageClient;
        },
      } as unknown as ILanguageClientAdapter;

      const baseWorkspace = stubWorkspaceConfiguration('snyk.loglevel', 'trace');
      const workspace = {
        ...baseWorkspace,
        onDidChangeConfiguration: (fn: (e: { affectsConfiguration: (s: string) => boolean }) => void) => {
          onListener(fn);
          return { dispose: sinon.stub() };
        },
      } as IVSCodeWorkspace;

      return new LanguageServer(
        user,
        configurationMock,
        adapter,
        workspace,
        new WindowMock(),
        authServiceMock,
        logger,
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        tracker,
        sinon.stub().resolves(),
        undefined,
        suppressor,
      );
    }

    test('adversarial ordering — listener fires AFTER markPendingReset: pending reset SURVIVES when suppressor is active', () => {
      // This test proves the fix. Without the suppressor check in the listener,
      // the listener would call markExplicitlyChanged which deletes the pending
      // reset, causing the LS to never receive { value: null, changed: true }.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      const suppressor = new ConfigFeedbackSuppressor();

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, suppressor, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Step 1: Simulate the outbound reset suppression window begins.
      suppressor.begin();

      // Step 2: markPendingReset is called (as applyOutboundGlobalResets does after updateConfiguration).
      tracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Step 3: VS Code fires onDidChangeConfiguration for the reset key (adversarial ordering:
      // fires AFTER markPendingReset). The listener MUST be suppressed and not call markExplicitlyChanged.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      // Step 4: suppression window ends.
      suppressor.end();

      // The pending reset MUST still be present — the listener must not have deleted it.
      const pending = tracker.consumePendingResets();
      assert.ok(
        pending.has(LS_GLOBAL_KEY.organization),
        'Pending reset must survive when the listener fires after markPendingReset — ' +
          'the suppressor must prevent markExplicitlyChanged from deleting the pending reset.',
      );
    });

    test('adversarial ordering — WITHOUT suppressor, pending reset IS lost (demonstrates the bug)', () => {
      // This test documents the pre-fix behavior: without suppression, the listener
      // cancels the pending reset. The fix is the suppressor; this test proves the
      // underlying timing sensitivity is real with the real tracker.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      // No suppressor — listener fires unsuppressed.
      const noSuppressor = new ConfigFeedbackSuppressor();
      // We do NOT call noSuppressor.begin(), so isActive is false.

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, noSuppressor, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // markPendingReset FIRST (as applyOutboundGlobalResets does).
      tracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Listener fires AFTER (adversarial) — no suppression active, so it calls
      // markExplicitlyChanged which deletes from pendingResets.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      const pending = tracker.consumePendingResets();
      // Without suppression the pending reset IS deleted — this is the pre-fix bug.
      assert.ok(
        !pending.has(LS_GLOBAL_KEY.organization),
        'Without suppression, adversarial listener ordering deletes the pending reset — ' +
          'this is the exact timing bug that the outboundResetSuppressor fix addresses.',
      );
    });

    test('suppressor.isActive gates correctly: begin/end pairs are reference-counted', () => {
      const suppressor = new ConfigFeedbackSuppressor();
      assert.strictEqual(suppressor.isActive, false, 'initially inactive');

      suppressor.begin();
      assert.strictEqual(suppressor.isActive, true, 'active after begin');

      suppressor.begin();
      assert.strictEqual(suppressor.isActive, true, 'still active after second begin');

      suppressor.end();
      assert.strictEqual(suppressor.isActive, true, 'still active after first end (depth=1)');

      suppressor.end();
      assert.strictEqual(suppressor.isActive, false, 'inactive after second end (depth=0)');
    });

    test('listener still fires normally when suppressor is NOT active (no regression)', () => {
      // Normal user edit: suppressor is inactive, listener SHOULD call markExplicitlyChanged.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      const suppressor = new ConfigFeedbackSuppressor(); // never begin()-ed

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, suppressor, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Fire listener without suppressor active — must mark the key.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      // At least one snyk.* LS key must be marked explicitly.
      // (VSCODE_KEY_TO_LS_KEYS maps snyk.* vscode keys to LS keys; affectsConfiguration returns
      //  true for all of them, so all snyk.* LS keys that have a vscodeKey get marked.)
      assert.ok(
        tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
        'organization LS key must be marked explicitly when listener fires without suppression',
      );
    });
  });

  suite('CLI protocol version guard', () => {
    function createTrackingAdapter(): {
      adapter: ILanguageClientAdapter;
      createSpy: sinon.SinonSpy;
      startStub: sinon.SinonStub;
    } {
      const startStub = sinon.stub().resolves();
      const create = sinon.spy(
        (): LanguageClient =>
          ({
            start: startStub,
            onNotification: sinon.stub(),
            onReady: sinon.stub().resolves(),
            sendNotification: sinon.stub().resolves(),
          } as unknown as LanguageClient),
      );
      const adapter = { create } as unknown as ILanguageClientAdapter;
      return { adapter, createSpy: create, startStub };
    }

    test('does not start the LanguageClient when CLI protocol version mismatches', async () => {
      protocolVersionStub.resolves(PROTOCOL_VERSION + 1);
      const { adapter, createSpy, startStub } = createTrackingAdapter();
      const window = new WindowMock();
      window.showErrorMessage.resolves(undefined);

      languageServer = new LanguageServer(
        user,
        configurationMock,
        adapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
        window,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        explicitLspConfigurationChangeTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.notCalled(createSpy);
      sinon.assert.notCalled(startStub);
      sinon.assert.calledOnce(window.showErrorMessage);
      assert.match(
        window.showErrorMessage.firstCall.args[0] as string,
        new RegExp(`expected ${PROTOCOL_VERSION}, got ${PROTOCOL_VERSION + 1}`),
      );
      assert.strictEqual(window.showErrorMessage.firstCall.args[1], 'Open Settings');
    });

    test('does not start the LanguageClient when CLI protocol version probe fails', async () => {
      protocolVersionStub.resolves(undefined);
      const { adapter, createSpy, startStub } = createTrackingAdapter();
      const window = new WindowMock();
      window.showErrorMessage.resolves(undefined);

      languageServer = new LanguageServer(
        user,
        configurationMock,
        adapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
        window,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        explicitLspConfigurationChangeTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.notCalled(createSpy);
      sinon.assert.notCalled(startStub);
      sinon.assert.calledOnce(window.showErrorMessage);
      assert.match(window.showErrorMessage.firstCall.args[0] as string, /Failed to verify/);
    });

    test('starts the LanguageClient when the CLI reports the "development" protocol version', async () => {
      protocolVersionStub.resolves('development');
      const { adapter, createSpy, startStub } = createTrackingAdapter();
      const window = new WindowMock();

      languageServer = new LanguageServer(
        user,
        configurationMock,
        adapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
        window,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        explicitLspConfigurationChangeTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.calledOnce(createSpy);
      sinon.assert.calledOnce(startStub);
      sinon.assert.notCalled(window.showErrorMessage);
    });

    test('opens Snyk HTML settings panel when user clicks Open Settings', async () => {
      protocolVersionStub.resolves(PROTOCOL_VERSION + 1);
      const { adapter } = createTrackingAdapter();
      const window = new WindowMock();
      window.showErrorMessage.resolves('Open Settings');
      const commands = new CommandsMock();
      commands.executeCommand.resolves(undefined);

      languageServer = new LanguageServer(
        user,
        configurationMock,
        adapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
        window,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        commands,
        {} as IDiagnosticsIssueProvider<unknown>,
        explicitLspConfigurationChangeTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.calledOnceWithExactly(commands.executeCommand, 'snyk.settings');
    });
  });
});
