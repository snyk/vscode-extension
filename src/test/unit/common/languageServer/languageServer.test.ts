import assert, { deepStrictEqual, strictEqual } from 'assert';
import { ReplaySubject, Subject } from 'rxjs';
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
import { SETTINGS_REGISTRY } from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
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
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IDiagnosticsIssueProvider } from '../../../../snyk/common/services/diagnosticsService';
import { IMcpProvider } from '../../../../snyk/common/vscode/mcpProvider';
import { ITreeViewProviderService } from '../../../../snyk/base/treeView/treeViewProviderService';
import { IWorkspaceConfigurationWebviewProvider } from '../../../../snyk/common/views/workspaceConfiguration/types/workspaceConfiguration.types';
import type { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { ExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { ConfigFeedbackSuppressor } from '../../../../snyk/common/languageServer/configFeedbackSuppressor';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import { ShowIssueDetailTopicParams } from '../../../../snyk/common/languageServer/types';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
} from '../../../../snyk/common/vscode/types';

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
    committedSinceReset: () => false,
    markCommittedSinceReset: sinon.stub(),
    hasLastKnownValue: () => false,
    getLastKnownValue: () => undefined,
    setLastKnownValue: sinon.stub(),
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
      getAdditionalCliEnvironment() {
        return '';
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
      committedSinceReset: () => false,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
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
      committedSinceReset: () => false,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
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
      committedSinceReset: () => false,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
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

  test('resolver throw in currentValueOf does not prevent sibling LS keys from being marked', async () => {
    // This test covers the loop-continuity guarantee: the lambda passed to
    // markExplicitLsKeysFromConfigurationChangeEvent as currentValueOf must not let a
    // synchronous throw from entry.resolve() escape and abort processing of the remaining
    // LS keys in the same event.
    //
    // We use the severity fan-out group (four LS keys share snyk.severity) so we can:
    //   - make severityFilterCritical.resolve throw
    //   - pre-warm the cache for severityFilterHigh with its current value (true) so that
    //     its "newValue === oldValue" comparison suppresses markCommittedSinceReset — proving
    //     the selectivity of the fan-out path (the assertion is not vacuously true)
    //   - assert severityFilterMedium IS still marked committedSinceReset (loop continuity)
    //   - assert severityFilterHigh is NOT marked committedSinceReset (value unchanged, warm cache)
    //
    // The mock configurationMock has severityFilter: DEFAULT_SEVERITY_FILTER = {critical:true,
    // high:true, medium:true, low:true}, so severityFilterHigh.resolve returns true.
    // By returning hasLastKnownValue=true and getLastKnownValue=true for severityFilterHigh,
    // the fan-out path sees cacheWasCold=false and isEqual(true,true)=true → does NOT call
    // markCommittedSinceReset for that key.  If the try/catch were removed and the throw from
    // severityFilterCritical escaped, the loop would abort before reaching severityFilterMedium,
    // and the sinon.assert.calledWith(markCommittedSinceResetStub, severityFilterMedium) would fail.
    const markCommittedSinceResetStub = sinon.stub();
    const markExplicitlyChangedStub = sinon.stub();

    // severityFilterHigh gets a warm cache returning the same value as its resolver (true).
    // All other keys get a cold cache (hasLastKnownValue returns false) so they ARE marked.
    const warmKey = LS_GLOBAL_KEY.severityFilterHigh;
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: markExplicitlyChangedStub,
      unmarkExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: () => true,
      markPendingReset: sinon.stub(),
      consumePendingResets: sinon.stub().returns(new Set<string>()),
      committedSinceReset: () => false,
      markCommittedSinceReset: markCommittedSinceResetStub,
      hasLastKnownValue: (lsKey: string) => lsKey === warmKey,
      getLastKnownValue: (lsKey: string) => (lsKey === warmKey ? true : undefined),
      setLastKnownValue: sinon.stub(),
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

    // Patch the resolver AFTER start() so getInitializationOptions (called during start)
    // is unaffected. We only want the throw to occur in the onDidChangeConfiguration path.
    const originalCriticalResolve = SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve;
    SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve = () => {
      throw new Error('resolver boom');
    };

    try {
      // Trigger a snyk.severity change — all four severity LS keys share that VS Code key.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk.severity' });

      // PRIMARY ASSERTION (loop continuity): despite severityFilterCritical.resolve throwing,
      // severityFilterMedium must still be marked in both cumulative and windowed signals.
      // If the try/catch is removed the throw escapes and aborts the loop — this fails RED.
      sinon.assert.calledWith(markExplicitlyChangedStub, LS_GLOBAL_KEY.severityFilterMedium);
      sinon.assert.calledWith(markCommittedSinceResetStub, LS_GLOBAL_KEY.severityFilterMedium);

      // SELECTIVITY ASSERTION (non-vacuous committedSinceReset): severityFilterHigh has a
      // warm cache whose value matches its current resolver output (true === true), so the
      // fan-out path must NOT mark it committedSinceReset.  Without the warm-cache setup,
      // cacheWasCold would always be true and this assertion would pass vacuously.
      sinon.assert.neverCalledWith(markCommittedSinceResetStub, LS_GLOBAL_KEY.severityFilterHigh);

      // Cumulative signal IS still marked for severityFilterHigh (markExplicitlyChanged is
      // unconditional in the fan-out path — it drives changed:true regardless of value).
      sinon.assert.calledWith(markExplicitlyChangedStub, LS_GLOBAL_KEY.severityFilterHigh);
    } finally {
      // Restore the original resolver regardless of test outcome.
      SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve = originalCriticalResolve;
    }
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
        committedSinceReset: () => false,
        markCommittedSinceReset: sinon.stub(),
        hasLastKnownValue: () => false,
        getLastKnownValue: () => undefined,
        setLastKnownValue: sinon.stub(),
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

    test('getInitializationOptions re-enqueues pending resets when fromConfiguration rejects', async () => {
      // Arrange: tracker with one pending reset key.
      const markPendingResetStub = sinon.stub();
      const pendingResetTracker: IExplicitLspConfigurationChangeTracker = {
        markExplicitlyChanged: sinon.stub(),
        unmarkExplicitlyChanged: sinon.stub(),
        isExplicitlyChanged: () => false,
        markPendingReset: markPendingResetStub,
        consumePendingResets: sinon.stub().returns(new Set<string>([LS_GLOBAL_KEY.organization])),
        committedSinceReset: () => false,
        markCommittedSinceReset: sinon.stub(),
        hasLastKnownValue: () => false,
        getLastKnownValue: () => undefined,
        setLastKnownValue: sinon.stub(),
      };

      // Stub fromConfiguration to reject after consumePendingResets has drained the set.
      const fromConfigError = new Error('fromConfiguration failed in getInitializationOptions');
      sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

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

      // Act + Assert: must throw, AND the key must be re-enqueued.
      await assert.rejects(() => ls.getInitializationOptions(), fromConfigError);

      // The drained key must have been re-enqueued via markPendingReset so the next init retries.
      sinon.assert.calledWith(markPendingResetStub, LS_GLOBAL_KEY.organization);
    });

    test('getInitializationOptions does not re-enqueue a pending reset key that was explicitly changed during the await gap', async () => {
      // Arrange: two keys pending reset — 'organization' and 'cliPath'.
      // Simulate the race: consumePendingResets drained the live set, then during the
      // await gap the user re-edited 'organization' (committedSinceReset returns true for it).
      // 'cliPath' was NOT re-edited (committedSinceReset returns false).
      // ADR-2: the guard reads committedSinceReset, not isExplicitlyChanged.
      const markPendingResetStub = sinon.stub();
      const pendingResetTracker: IExplicitLspConfigurationChangeTracker = {
        markExplicitlyChanged: sinon.stub(),
        unmarkExplicitlyChanged: sinon.stub(),
        isExplicitlyChanged: sinon.stub().returns(false),
        markPendingReset: markPendingResetStub,
        consumePendingResets: sinon
          .stub()
          .returns(new Set<string>([LS_GLOBAL_KEY.organization, LS_GLOBAL_KEY.cliPath])),
        committedSinceReset: (key: string) => key === LS_GLOBAL_KEY.organization,
        markCommittedSinceReset: sinon.stub(),
        hasLastKnownValue: () => false,
        getLastKnownValue: () => undefined,
        setLastKnownValue: sinon.stub(),
      };

      const fromConfigError = new Error('fromConfiguration failed during race (getInitializationOptions)');
      sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

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

      // Act + Assert: must throw, AND only the key that was NOT re-edited gets re-enqueued.
      await assert.rejects(() => ls.getInitializationOptions(), fromConfigError);

      // 'cliPath' was NOT re-edited → must be re-enqueued so the next init retries.
      sinon.assert.calledWith(markPendingResetStub, LS_GLOBAL_KEY.cliPath);
      // 'organization' WAS re-edited with a concrete value → must NOT be re-enqueued,
      // or the pending reset would clobber the user's new concrete value on the next init.
      sinon.assert.neverCalledWith(markPendingResetStub, LS_GLOBAL_KEY.organization);
    });

    test('pending reset is delivered exactly once: middleware pull drains; getInitializationOptions does not re-deliver', async () => {
      // Arrange: one real tracker shared by both consumers.
      const sharedTracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      sharedTracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Wire tracker into middleware.
      const middleware = new LanguageClientMiddleware(
        new LoggerMockFailOnErrors(),
        configurationMock,
        new Subject<ShowIssueDetailTopicParams>(),
        {} as IUriAdapter,
        {} as IVSCodeCommands,
        undefined,
        sharedTracker,
      );

      const handler: ConfigurationRequestHandlerSignature = (
        _params: ConfigurationParams,
        _token: CancellationToken,
      ) => [{}];
      const token: CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: sinon.fake(),
      };

      // Consumer A: middleware pull — drains pendingResets and emits {value:null, changed:true}.
      const pullResult = await middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler);
      if (pullResult instanceof Error) {
        assert.fail('Middleware pull returned an error');
      }
      // middleware returns [{ settings: LspConfigurationParam }]; LspConfigurationParam.settings is the key→value map.
      const pullItem = (
        pullResult as Array<{ settings: { settings?: Record<string, { value: unknown; changed: boolean }> } }>
      )[0];
      const pullSettings = pullItem.settings.settings!;
      strictEqual(pullSettings[LS_GLOBAL_KEY.organization]?.value, null, 'middleware pull: value must be null');
      strictEqual(pullSettings[LS_GLOBAL_KEY.organization]?.changed, true, 'middleware pull: changed must be true');

      // Consumer B: getInitializationOptions — pendingResets is now empty (drained by A).
      const mockLca = {
        create: sinon.stub().returns({ start: sinon.stub().resolves() }),
        getLanguageClient: sinon.stub().returns({ start: sinon.stub().resolves() }),
      };
      const ls = new LanguageServer(
        user,
        configurationMock,
        mockLca,
        {} as IVSCodeWorkspace,
        new WindowMock(),
        authServiceMock,
        new LoggerMockFailOnErrors(),
        downloadServiceMock,
        {} as IMcpProvider,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        new CommandsMock(),
        {} as IDiagnosticsIssueProvider<unknown>,
        sharedTracker,
        sinon.stub().resolves(),
        undefined,
        new ConfigFeedbackSuppressor(),
      );

      const initOptions = await ls.getInitializationOptions();

      // The reset was already delivered by the middleware pull, so getInitializationOptions
      // must NOT re-deliver it as {value:null, changed:true}.
      const initSetting = initOptions.settings[LS_GLOBAL_KEY.organization];
      strictEqual(
        initSetting?.changed,
        false,
        'getInitializationOptions must not re-deliver the reset after middleware already consumed it',
      );
      assert.notStrictEqual(
        initSetting?.value,
        null,
        'getInitializationOptions must not emit null again for an already-delivered reset',
      );
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

    test('markExplicitlyChanged deletes pending reset when suppressor is inactive (adversarial timing root cause)', () => {
      // This test documents the root cause of the adversarial timing bug: when the
      // suppressor is inactive (isActive === false), the onDidChangeConfiguration listener
      // calls markExplicitlyChanged, which deletes the key from pendingResets.
      // The fix (the suppressor guard in the listener) is proven by the sibling test above.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      // Suppressor is never begin()-ed, so isActive remains false throughout.
      const inactiveSuppressor = new ConfigFeedbackSuppressor();

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, inactiveSuppressor, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Queue a pending reset (simulates what applyOutboundGlobalResets does after updateConfiguration).
      tracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Listener fires while suppressor is inactive — markExplicitlyChanged is called,
      // which calls pendingResets.delete(key), removing the pending reset signal.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      const pending = tracker.consumePendingResets();
      // With suppressor inactive, markExplicitlyChanged deletes the pending reset.
      assert.ok(
        !pending.has(LS_GLOBAL_KEY.organization),
        'markExplicitlyChanged deletes from pendingResets when the suppressor is inactive — ' +
          'this is the timing sensitivity that the outboundResetSuppressor guard in the listener addresses.',
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
