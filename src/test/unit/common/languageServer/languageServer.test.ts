import assert, { deepStrictEqual, strictEqual } from 'assert';
import { ReplaySubject, Subject } from 'rxjs';
import sinon from 'sinon';
import { v4 } from 'uuid';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import {
  Configuration,
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
import { ADVANCED_ORGANIZATION } from '../../../../snyk/common/constants/settings';
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
import { ExplicitOverridesMap } from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import { ConfigurationPersistenceService } from '../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import {
  IScopeDetectionService,
  ScopeDetectionService,
} from '../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
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
    markPendingInboundWrite: sinon.stub(),
    consumePendingInboundWrite: sinon.stub().returns(false),
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

  // Real ConfigurationPersistenceService (same wiring as extension.ts) with a fan-out
  // settings payload, and a workspace whose onDidChangeConfiguration dispatch is a genuinely
  // separate async round-trip from the write — modeling real VS Code (settings.json write,
  // then a later file-watcher-driven config refresh), not one synchronous call.
  test('inbound LS persistence never marks settings explicit, even on a delayed change event', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
    // [IDE-2264 ticket 03]: wired the same way as extension.ts, to prove by construction that
    // an inbound push never writes to the explicit-overrides map — even for a migration-shaped
    // payload whose resulting change events are delayed past this operation's completion.
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());

    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const store = new Map<string, unknown>();

    const workspace = {
      getWorkspaceFolders: () => [],
      getWorkspaceFolderPaths: () => [],
      getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
      inspectConfiguration: () => ({
        defaultValue: undefined,
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
      updateConfiguration: (configId: string, section: string, value: unknown) => {
        store.set(`${configId}.${section}`, value);
        // Real VS Code write-then-notify is two separate round-trips (settings.json write,
        // then a file-watcher-driven config refresh) — not one synchronous call. Model that
        // gap with a real macrotask, not a test-triggered flush.
        setTimeout(() => configListener({ affectsConfiguration: (s: string) => s === `${configId}.${section}` }), 0);
        return Promise.resolve();
      },
    } as unknown as IVSCodeWorkspace;

    const scopeDetectionService = new ScopeDetectionService(workspace);
    const clientAdapter = { getLanguageClient: () => undefined } as unknown as ILanguageClientAdapter;
    const lastKnownValueCache = new LastKnownValueCache(workspace, []);
    const configPersistenceService = new ConfigurationPersistenceService(
      workspace,
      configurationMock,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
      explicitOverridesMap,
      lastKnownValueCache,
    );

    const { notificationHandlers, adapter } = createRecordingLanguageClientAdapter();
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
      view => configPersistenceService.persistInboundLspConfiguration(view),
      undefined,
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();

    // Realistic fully-default-upgrade payload: a fan-out group (severity -> 1 vscode write,
    // 4 LS keys) plus two single-key writes -- mirrors the ticket's multi-vscode-key-write shape.
    const handler = notificationHandlers['$/snyk.configuration'];
    handler({
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: true, changed: false },
        [LS_GLOBAL_KEY.trustedFolders]: { value: ['/trusted'], changed: false },
        [LS_GLOBAL_KEY.organization]: { value: 'my-org', changed: false },
      },
    });

    // Let the real write chain (and its finally-block flag reset) finish...
    await new Promise(resolve => setTimeout(resolve, 0));
    // ...then let the deferred change-event dispatches (also scheduled via setTimeout) run.
    await new Promise(resolve => setTimeout(resolve, 0));

    for (const lsKey of [
      LS_GLOBAL_KEY.severityFilterCritical,
      LS_GLOBAL_KEY.severityFilterHigh,
      LS_GLOBAL_KEY.severityFilterMedium,
      LS_GLOBAL_KEY.severityFilterLow,
      LS_GLOBAL_KEY.trustedFolders,
      LS_GLOBAL_KEY.organization,
    ]) {
      assert.strictEqual(
        tracker.isExplicitlyChanged(lsKey),
        false,
        `${lsKey}: inbound-persisted setting must not be marked explicit just because VS Code ` +
          'delivered the change event on a later tick than the write',
      );
      assert.strictEqual(
        explicitOverridesMap.getEntry(lsKey),
        undefined,
        `${lsKey}: an inbound push must never write to the explicit-overrides map, even for a ` +
          "migration-shaped payload whose change events are delayed past this operation's completion",
      );
    }
  });

  // Real VS Code fires no onDidChangeConfiguration event for a no-op write (clearing an
  // override that was never set). markPendingInboundWrite is called before every reset
  // write regardless, so a never-overridden GLOBAL_RESET_FIELDS key leaks a marker that
  // is never consumed by this write's own (nonexistent) event — it survives to wrongly
  // suppress the marking of the user's next genuine edit of that same key [IDE-2264].
  test('global reset of a never-overridden key does not leak a pending marker into the next genuine user edit', async () => {
    const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const store = new Map<string, unknown>();

    const workspace = {
      getWorkspaceFolders: () => [],
      getWorkspaceFolderPaths: () => [],
      getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
      inspectConfiguration: (configId: string, section: string) => ({
        defaultValue: undefined,
        globalValue: store.get(`${configId}.${section}`),
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      }),
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
      updateConfiguration: (configId: string, section: string, value: unknown) => {
        const key = `${configId}.${section}`;
        const valueActuallyChanges = store.get(key) !== value;
        store.set(key, value);
        // Only a write that actually changes the persisted value gets a follow-up event —
        // same real-VS-Code timing gap modeled in the sibling test above (delayed, not
        // synchronous), but no event at all when the write is a no-op.
        if (valueActuallyChanges) {
          setTimeout(() => configListener({ affectsConfiguration: (s: string) => s === key }), 0);
        }
        return Promise.resolve();
      },
    } as unknown as IVSCodeWorkspace;

    const scopeDetectionService = new ScopeDetectionService(workspace);
    const clientAdapter = { getLanguageClient: () => undefined } as unknown as ILanguageClientAdapter;
    const configPersistenceService = new ConfigurationPersistenceService(
      workspace,
      configurationMock,
      scopeDetectionService,
      clientAdapter,
      logger,
      undefined,
      tracker,
    );

    const { notificationHandlers, adapter } = createRecordingLanguageClientAdapter();
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
      view => configPersistenceService.persistInboundLspConfiguration(view),
      undefined,
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();

    // organization was never overridden (globalValue undefined in the fake store above).
    // A "reset to project defaults" nulls it anyway — the clear-to-undefined write is a
    // no-op, so no config-change event follows to consume the pending marker.
    const handler = notificationHandlers['$/snyk.configuration'];
    handler({
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    // The user now genuinely edits the same setting by hand (e.g. an external settings.json
    // edit) — a real config-change event that our code never caused.
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    configListener({ affectsConfiguration: (s: string) => s === `${configurationId}.${section}` });

    assert.strictEqual(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      true,
      'a genuine user edit must be marked explicit even though an earlier no-op reset write left a pending marker',
    );
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
      markPendingInboundWrite: sinon.stub(),
      consumePendingInboundWrite: sinon.stub().returns(false),
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
      markPendingInboundWrite: sinon.stub(),
      consumePendingInboundWrite: sinon.stub().returns(false),
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
      markPendingInboundWrite: sinon.stub(),
      consumePendingInboundWrite: sinon.stub().returns(false),
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
      markPendingInboundWrite: sinon.stub(),
      consumePendingInboundWrite: sinon.stub().returns(false),
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
        markPendingInboundWrite: sinon.stub(),
        consumePendingInboundWrite: sinon.stub().returns(false),
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
        markPendingInboundWrite: sinon.stub(),
        consumePendingInboundWrite: sinon.stub().returns(false),
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
        markPendingInboundWrite: sinon.stub(),
        consumePendingInboundWrite: sinon.stub().returns(false),
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

    test('snyk.configuration notification calls reloadIfOpen after inbound persistence', async () => {
      const callOrder: string[] = [];
      const persistStub = sinon.stub().callsFake(() => {
        callOrder.push('persist');
      });
      let resolveReload!: () => void;
      const reloadDone = new Promise<void>(r => {
        resolveReload = r;
      });
      const reloadStub = sinon.stub().callsFake(() => {
        callOrder.push('reload');
        resolveReload();
      });
      const providerMock: IWorkspaceConfigurationWebviewProvider = {
        showPanel: sinon.stub(),
        disposePanel: sinon.stub(),
        setAuthToken: sinon.stub(),
        reloadIfOpen: reloadStub,
      };

      const { notificationHandlers, adapter } = createRecordingLanguageClientAdapter();
      languageServer = new LanguageServer(
        user,
        configurationMock,
        adapter,
        stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
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
        persistStub,
        undefined,
      );
      languageServer.setWorkspaceConfigurationProvider(providerMock);
      downloadServiceMock.downloadReady$.next();
      await languageServer.start();

      const handler = notificationHandlers['$/snyk.configuration'];
      handler({ settings: {} });

      // Wait deterministically until reloadIfOpen is actually called
      await reloadDone;

      sinon.assert.calledOnce(reloadStub);
      deepStrictEqual(callOrder, ['persist', 'reload']);
    });

    test('snyk.configuration notification does not throw when no provider is set', async () => {
      const { notificationHandlers } = await startLanguageServerWithRecordingClient();

      const handler = notificationHandlers['$/snyk.configuration'];
      handler({ settings: {} });

      // Flush microtask queue to ensure the void chain completes
      await Promise.resolve();
    });
  });

  // ── Outbound reset self-cancel guard (IDE-2149, fixed via write-time tag in IDE-2264) ──
  //
  // markExplicitlyChanged calls pendingResets.delete so that a user re-edit after a reset
  // cancels the stale pending signal. But the onDidChangeConfiguration listener (registered
  // in registerExplicitKeyMarkingListener) also calls markExplicitlyChanged for ANY snyk.*
  // setting change — including the change triggered by the reset's own updateConfiguration
  // write.
  //
  // Adversarial ordering:
  //   1. applyOutboundGlobalResets calls updateConfiguration (clears VS Code override)
  //   2. markPendingReset(key) — key is now in pendingResets
  //   3. VS Code fires onDidChangeConfiguration (asynchronously, after step 2)
  //   4. listener calls markExplicitlyChanged(key) → pendingResets.delete(key) → LOST
  //
  // Fix (IDE-2264): applyVscodeKeyResets tags each vscodeKey with markPendingInboundWrite
  // before its write, mirroring the inbound-persistence fix. The listener consumes that tag
  // (consumePendingInboundWrite) instead of relying on a suppression window scoped to the
  // synchronous duration of the write — correct no matter when the change event arrives.
  // (An earlier suppressor-based guard, outboundResetSuppressor, made exactly that timing
  // assumption and was removed as dead code once the tag-based fix landed.)
  suite('outbound reset self-cancel guard (adversarial onDidChangeConfiguration ordering)', () => {
    function makeLanguageServerWithListener(
      tracker: ExplicitLspConfigurationChangeTracker,
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
      );
    }

    test('adversarial ordering — listener fires AFTER markPendingReset: pending reset SURVIVES via the write-time tag', () => {
      // Proves the IDE-2264 fix: markPendingInboundWrite(vscodeKey) — set by
      // applyVscodeKeyResets right before its write, exactly as it would be in production —
      // is enough on its own, independent of the change event's timing.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Step 1: tag the vscodeKey, as applyVscodeKeyResets does right before its write.
      tracker.markPendingInboundWrite(ADVANCED_ORGANIZATION);

      // Step 2: markPendingReset is called (as applyOutboundGlobalResets does after updateConfiguration).
      tracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Step 3: VS Code fires onDidChangeConfiguration for the reset key (adversarial ordering:
      // fires AFTER markPendingReset). The listener must consume the tag and skip marking.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      // The pending reset MUST still be present — the listener must not have deleted it.
      const pending = tracker.consumePendingResets();
      assert.ok(
        pending.has(LS_GLOBAL_KEY.organization),
        'Pending reset must survive when the listener fires after markPendingReset — ' +
          'the write-time tag must prevent markExplicitlyChanged from deleting the pending reset.',
      );
    });

    test('markExplicitlyChanged deletes pending reset when the write is untagged (adversarial timing root cause)', () => {
      // Documents the root cause: without the write-time tag, the onDidChangeConfiguration
      // listener calls markExplicitlyChanged for any snyk.* change, which deletes the key
      // from pendingResets. The fix (tagging the write) is proven by the sibling test above.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Queue a pending reset (simulates what applyOutboundGlobalResets does after updateConfiguration).
      tracker.markPendingReset(LS_GLOBAL_KEY.organization);

      // Listener fires without a pending-write tag — markExplicitlyChanged is called,
      // which calls pendingResets.delete(key), removing the pending reset signal.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      const pending = tracker.consumePendingResets();
      assert.ok(
        !pending.has(LS_GLOBAL_KEY.organization),
        'markExplicitlyChanged deletes from pendingResets when the write was not tagged — ' +
          'this is the timing sensitivity the write-time tag in the listener addresses.',
      );
    });

    test('listener still fires normally for an untagged user edit (no regression)', () => {
      // Normal user edit: no pending-write tag, listener SHOULD call markExplicitlyChanged.
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const ls = makeLanguageServerWithListener(tracker, fn => {
        configListener = fn;
      });

      ls.registerExplicitKeyMarkingListener();

      // Fire listener for an untagged change — must mark the key.
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });

      // At least one snyk.* LS key must be marked explicitly.
      // (VSCODE_KEY_TO_LS_KEYS maps snyk.* vscode keys to LS keys; affectsConfiguration returns
      //  true for all of them, so all snyk.* LS keys that have a vscodeKey get marked.)
      assert.ok(
        tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
        'organization LS key must be marked explicitly when listener fires for an untagged change',
      );
    });

    // The outbound save path now records a reset directly in the explicit-overrides map
    // (ConfigurationPersistenceService.applyOutboundGlobalResets) instead of the old tracker's
    // write-time tag + pendingResets set. Nothing wires the onDidChangeConfiguration listener to
    // the explicit-overrides map, so a genuinely delayed dispatch has nothing to interfere with —
    // this adversarial-ordering class of bug is now structurally impossible for the outbound leg.
    test('a change event delayed past the write does not affect the explicit-overrides reset entry', async () => {
      const tracker = new ExplicitLspConfigurationChangeTracker(makeMemento());
      const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());

      let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
      const deferredDispatches: Array<() => void> = [];

      // Only used by ConfigurationPersistenceService (writes) — the listener under test comes
      // from makeLanguageServerWithListener's own workspace, captured via onListener below.
      const workspace = {
        getWorkspaceFolders: () => [],
        getWorkspaceFolderPaths: () => [],
        getConfiguration: () => undefined,
        inspectConfiguration: () => ({
          defaultValue: undefined,
          globalValue: 'existing-org',
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        }),
        updateConfiguration: () => {
          // Same real-world gap as the inbound case: settings.json write and the change-event
          // broadcast are two separate round-trips, not one synchronous call.
          deferredDispatches.push(() => configListener({ affectsConfiguration: (s: string) => s.startsWith('snyk.') }));
          return Promise.resolve();
        },
      } as unknown as IVSCodeWorkspace;

      const scopeDetectionService = {
        getSettingScope: () => 'user',
        populateScopeIndicators: () => '',
        shouldSkipSettingUpdate: () => false,
      } as unknown as IScopeDetectionService;
      const clientAdapter = {
        getLanguageClient: () => ({ sendNotification: sinon.stub().resolves() }),
      } as unknown as ILanguageClientAdapter;
      const configPersistenceService = new ConfigurationPersistenceService(
        workspace,
        configurationMock,
        scopeDetectionService,
        clientAdapter,
        logger,
        undefined,
        tracker,
        explicitOverridesMap,
      );

      const ls = makeLanguageServerWithListener(tracker, fn => {
        configListener = fn;
      });
      ls.registerExplicitKeyMarkingListener();

      await configPersistenceService.handleSaveConfig(
        JSON.stringify({ isFallbackForm: false, [LS_GLOBAL_KEY.organization]: null }),
      );

      // The reset is recorded directly — no write-time tag involved.
      assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), { kind: 'reset' });

      // The change event finally arrives, long after the write returned.
      deferredDispatches.forEach(dispatch => dispatch());

      assert.deepStrictEqual(
        explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
        { kind: 'reset' },
        'a delayed onDidChangeConfiguration dispatch must not affect the explicit-overrides reset entry',
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
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.calledOnceWithExactly(commands.executeCommand, 'snyk.settings');
    });
  });
});
