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
import { ADVANCED_ORGANIZATION, SEVERITY_FILTER_SETTING } from '../../../../snyk/common/constants/settings';
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
import {
  ExplicitOverridesMap,
  IExplicitOverridesMap,
} from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache, ILastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import { ConfigurationPersistenceService } from '../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { InboundConfigPersistenceService } from '../../../../snyk/common/views/workspaceConfiguration/services/inboundConfigPersistenceService';
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

  const createFakeLanguageServer = (
    languageClientAdapter: ILanguageClientAdapter,
    workspace: IVSCodeWorkspace,
    treeViewProvider?: ITreeViewProviderService,
    explicitOverridesMap: IExplicitOverridesMap = new ExplicitOverridesMap(makeMemento()),
    lastKnownValueCache: ILastKnownValueCache = new LastKnownValueCache(workspace, []),
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
      sinon.stub().resolves(),
      treeViewProvider,
      explicitOverridesMap,
      lastKnownValueCache,
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

  /** Minimal in-memory Memento for ExplicitOverridesMap. */
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

  // [IDE-2264 ticket 11]: explicitOverridesMap/lastKnownValueCache are required constructor
  // params — a missing dependency now fails loudly at construction instead of silently
  // disabling explicit-marking. Constructed directly (not via createFakeLanguageServer,
  // whose default parameters would substitute a real instance for an explicit `undefined`).
  test('throws at construction when explicitOverridesMap is omitted', () => {
    assert.throws(
      () =>
        new LanguageServer(
          user,
          configurationMock,
          {} as ILanguageClientAdapter,
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
          sinon.stub().resolves(),
          undefined,
          undefined as unknown as IExplicitOverridesMap,
          new LastKnownValueCache({} as IVSCodeWorkspace, []),
        ),
      /requires explicitOverridesMap and lastKnownValueCache/,
    );
  });

  test('throws at construction when lastKnownValueCache is omitted', () => {
    assert.throws(
      () =>
        new LanguageServer(
          user,
          configurationMock,
          {} as ILanguageClientAdapter,
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
          sinon.stub().resolves(),
          undefined,
          new ExplicitOverridesMap(makeMemento()),
          undefined as unknown as ILastKnownValueCache,
        ),
      /requires explicitOverridesMap and lastKnownValueCache/,
    );
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
    const lastKnownValueCache = new LastKnownValueCache(workspace, []);
    const inboundConfigPersistenceService = new InboundConfigPersistenceService(
      workspace,
      configurationMock,
      scopeDetectionService,
      logger,
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
      view => inboundConfigPersistenceService.persistInboundLspConfiguration(view),
      undefined,
      // Same instances as inboundConfigPersistenceService above (mirrors extension.ts wiring), so the
      // ticket-04 direct-edit listener sees the cache updates the inbound-push write just made
      // and correctly recognizes the resulting change events as its own echo, not a user edit.
      explicitOverridesMap,
      lastKnownValueCache,
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
        explicitOverridesMap.getEntry(lsKey),
        undefined,
        `${lsKey}: an inbound push must never write to the explicit-overrides map, even for a ` +
          "migration-shaped payload whose change events are delayed past this operation's completion",
      );
    }
  });

  // Real VS Code fires no onDidChangeConfiguration event for a no-op write (clearing an
  // override that was never set). Historically (the write-time tag design), a never-
  // overridden GLOBAL_RESET_FIELDS key would leak a marker that no event ever consumed,
  // wrongly suppressing the marking of the user's next genuine edit of that key [IDE-2264].
  test('global reset of a never-overridden key does not leak a pending marker into the next genuine user edit', async () => {
    // [IDE-2264 ticket 04]: the old write-time tag (markPendingInboundWrite) this test used to
    // exercise is gone from the direct-edit listener — it now compares against this cache
    // instead, so a no-op reset write (nothing changes in the cache) cannot leak anything that
    // would suppress a later genuine edit.
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());

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

    const lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);
    const scopeDetectionService = new ScopeDetectionService(workspace);
    const inboundConfigPersistenceService = new InboundConfigPersistenceService(
      workspace,
      configurationMock,
      scopeDetectionService,
      logger,
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
      view => inboundConfigPersistenceService.persistInboundLspConfiguration(view),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();

    // organization was never overridden (globalValue undefined in the fake store above).
    // A "reset to project defaults" nulls it anyway — the clear-to-undefined write is a
    // no-op (nothing to clear), so no config-change event follows and the cache is untouched.
    const handler = notificationHandlers['$/snyk.configuration'];
    handler({
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    // The user now genuinely edits the same setting by hand (e.g. an external settings.json
    // edit) — the raw VS Code value actually changes, then a real config-change event fires
    // that our code never caused.
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    store.set(`${configurationId}.${section}`, 'user-edited-org');
    // The live IConfiguration the listener resolves through must reflect the same edit.
    (configurationMock as { organization: string }).organization = 'user-edited-org';
    configListener({ affectsConfiguration: (s: string) => s === `${configurationId}.${section}` });
    // The listener fires-and-forgets an async mark (single-key path awaits entry.resolve).
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepStrictEqual(
      explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization),
      { kind: 'value', value: 'user-edited-org' },
      'a genuine user edit must be marked explicit even though an earlier no-op reset write ' +
        'touched nothing that could suppress it',
    );
  });

  test('marks explicit LS keys when snyk settings change', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const store = new Map<string, unknown>();
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};

    const workspace = {
      getWorkspaceFolders: () => [],
      getWorkspaceFolderPaths: () => [],
      getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
    } as unknown as IVSCodeWorkspace;
    const lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);

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
      sinon.stub().resolves(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();

    // A genuine settings.json edit: the raw VS Code value changes...
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    store.set(`${configurationId}.${section}`, 'new-org');
    // ...and the live IConfiguration the listener resolves through reflects the same edit.
    (configurationMock as { organization: string }).organization = 'new-org';

    configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });
    // The listener fires-and-forgets an async mark (single-key path awaits entry.resolve).
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), {
      kind: 'value',
      value: 'new-org',
    });
  });

  test('does not mark explicit LS keys when only non-snyk configuration changes', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};

    const baseWorkspace = stubWorkspaceConfiguration('snyk.loglevel', 'trace');
    const workspace = {
      ...baseWorkspace,
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
    } as IVSCodeWorkspace;
    const lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);

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
      sinon.stub().resolves(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    configListener({ affectsConfiguration: () => false });
    assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), undefined);
  });

  test('tracks explicit LS keys while the LS is down (listener registered without start)', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const store = new Map<string, unknown>();
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const onDidChangeConfigurationStub = sinon.stub().callsFake((fn: typeof configListener) => {
      configListener = fn;
      return { dispose: sinon.stub() };
    });
    const createStub = sinon.stub();
    const adapter = { create: createStub } as unknown as ILanguageClientAdapter;

    const workspace = {
      getWorkspaceFolders: () => [],
      getWorkspaceFolderPaths: () => [],
      getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
      onDidChangeConfiguration: onDidChangeConfigurationStub,
    } as unknown as IVSCodeWorkspace;
    const lastKnownValueCache = new LastKnownValueCache(workspace, [ADVANCED_ORGANIZATION]);

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
      sinon.stub().resolves(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );

    // No start() — the CLI hasn't downloaded yet, but the listener must already be active.
    languageServer.registerExplicitKeyMarkingListener();
    // Idempotent: a second call must not subscribe again.
    languageServer.registerExplicitKeyMarkingListener();

    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    store.set(`${configurationId}.${section}`, 'new-org');
    (configurationMock as { organization: string }).organization = 'new-org';

    configListener({ affectsConfiguration: (s: string) => s === 'snyk' || s.startsWith('snyk.') });
    // The listener fires-and-forgets an async mark (single-key path awaits entry.resolve).
    await new Promise(resolve => setTimeout(resolve, 0));

    sinon.assert.calledOnce(onDidChangeConfigurationStub);
    assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), {
      kind: 'value',
      value: 'new-org',
    });
    sinon.assert.notCalled(createStub);
  });

  test('resolver throw for one fan-out sibling does not prevent the remaining siblings from being marked', async () => {
    // Loop-continuity guarantee: a synchronous throw from one fan-out sibling's entry.resolve()
    // must not abort processing of the remaining LS keys sharing the same VS Code setting.
    //
    // Severity fan-out group (four LS keys share snyk.severity):
    //   - severityFilterCritical.resolve throws
    //   - severityFilterHigh's raw value is unchanged (old === new) — must NOT be marked
    //     (proves selectivity: the assertion below is not vacuously true)
    //   - severityFilterMedium's raw value genuinely changed — must still be marked despite
    //     critical's throw occurring earlier in the same loop
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const store = new Map<string, unknown>();
    store.set('snyk.severity', { critical: true, high: true, medium: true, low: true });

    // Not the shared fail-on-error `logger` — this test deliberately provokes a resolver throw,
    // which [IDE-2264 ticket 12] now logs rather than silently swallows.
    const loggedErrors: unknown[] = [];
    const throwTolerantLogger = new LoggerMock();
    throwTolerantLogger.error = (message: string) => loggedErrors.push(message);

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

    const workspace = {
      getWorkspaceFolders: () => [],
      getWorkspaceFolderPaths: () => [],
      getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
      onDidChangeConfiguration: (fn: typeof configListener) => {
        configListener = fn;
        return { dispose: sinon.stub() };
      },
    } as unknown as IVSCodeWorkspace;
    const lastKnownValueCache = new LastKnownValueCache(workspace, [SEVERITY_FILTER_SETTING]);

    languageServer = new LanguageServer(
      user,
      configurationMock,
      adapter,
      workspace,
      new WindowMock(),
      authServiceMock,
      throwTolerantLogger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      new CommandsMock(),
      {} as IDiagnosticsIssueProvider<unknown>,
      sinon.stub().resolves(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
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
      // Only medium's raw value actually changes.
      store.set('snyk.severity', { critical: true, high: true, medium: false, low: true });
      configListener({ affectsConfiguration: (s: string) => s === SEVERITY_FILTER_SETTING });

      // PRIMARY ASSERTION (loop continuity): despite severityFilterCritical.resolve throwing,
      // severityFilterMedium must still be marked. If the throw escaped uncaught, the loop
      // would abort before reaching medium — this fails RED without the try/catch.
      assert.deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
        kind: 'value',
        value: false,
      });

      // SELECTIVITY ASSERTION: severityFilterHigh's raw value is unchanged, so it must not be
      // marked — proving the fan-out path only marks siblings that genuinely changed.
      assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterHigh), undefined);

      // A throwing resolver is treated as value-unknown on both the old and new projection, so
      // no (false) change is detected for critical itself.
      assert.strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.severityFilterCritical), undefined);

      // [IDE-2264 ticket 12]: the throw is logged rather than silently swallowed.
      assert.strictEqual(loggedErrors.length > 0, true, 'the resolver throw must be logged');
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

    // [IDE-2264 ticket 06]: pending resets queued before LS (re)start are emitted as
    // {value:null, changed:true} in initializationOptions, so a reset is not lost when the LS
    // restarts. Delivery is driven by the explicit-overrides map's reset sentinel, read live —
    // never drained into a separate pending-reset queue.
    test('getInitializationOptions emits {value:null,changed:true} for a pending-reset key in the explicit-overrides map', async () => {
      const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
      explicitOverridesMap.setReset(LS_GLOBAL_KEY.organization);

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
        sinon.stub().resolves(),
        undefined,
        explicitOverridesMap,
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );

      const options = await ls.getInitializationOptions();

      // The pending-reset key must emit {value:null, changed:true}.
      strictEqual(options.settings[LS_GLOBAL_KEY.organization]?.value, null);
      strictEqual(options.settings[LS_GLOBAL_KEY.organization]?.changed, true);

      // Confirmed delivered: the sentinel is cleared so it is not resent on the next call.
      strictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), undefined);
    });

    test('getInitializationOptions leaves a pending-reset entry untouched when fromConfiguration rejects (no premature drain)', async () => {
      const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
      explicitOverridesMap.setReset(LS_GLOBAL_KEY.organization);

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
        sinon.stub().resolves(),
        undefined,
        explicitOverridesMap,
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );

      await assert.rejects(() => ls.getInitializationOptions(), fromConfigError);

      // Never drained speculatively, so a failed build leaves the sentinel intact for retry.
      deepStrictEqual(explicitOverridesMap.getEntry(LS_GLOBAL_KEY.organization), { kind: 'reset' });
    });

    test('a concrete edit committed before the next call supersedes an earlier pending reset with no companion signal', async () => {
      // [IDE-2264 ticket 06]: setExplicitValue overwrites the same map slot a prior setReset
      // occupied — no separate "committed since reset" signal is read or needed.
      const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
      explicitOverridesMap.setReset(LS_GLOBAL_KEY.organization);
      explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.organization, 'user-set-org');
      (configurationMock as { organization: string }).organization = 'user-set-org';

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
        sinon.stub().resolves(),
        undefined,
        explicitOverridesMap,
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );

      const options = await ls.getInitializationOptions();

      // The reset never reaches the LS: the current configuration value flows through untouched.
      strictEqual(options.settings[LS_GLOBAL_KEY.organization]?.value, 'user-set-org');
    });

    test('pending reset is delivered exactly once: middleware pull confirms delivery; getInitializationOptions does not re-deliver', async () => {
      // Arrange: one real explicit-overrides map shared by both consumers.
      const sharedExplicitOverridesMap = new ExplicitOverridesMap(makeMemento());
      sharedExplicitOverridesMap.setReset(LS_GLOBAL_KEY.organization);
      const sharedLastKnownValueCache = new LastKnownValueCache({} as IVSCodeWorkspace, []);

      // Wire the map into middleware.
      const middleware = new LanguageClientMiddleware(
        new LoggerMockFailOnErrors(),
        configurationMock,
        new Subject<ShowIssueDetailTopicParams>(),
        {} as IUriAdapter,
        {} as IVSCodeCommands,
        undefined,
        sharedLastKnownValueCache,
        sharedExplicitOverridesMap,
      );

      const handler: ConfigurationRequestHandlerSignature = (
        _params: ConfigurationParams,
        _token: CancellationToken,
      ) => [{}];
      const token: CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: sinon.fake(),
      };

      // Consumer A: middleware pull — delivers {value:null, changed:true} and confirms it.
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

      // Consumer B: getInitializationOptions — the sentinel was already confirmed-delivered by A.
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
        sinon.stub().resolves(),
        undefined,
        sharedExplicitOverridesMap,
        sharedLastKnownValueCache,
      );

      const initOptions = await ls.getInitializationOptions();

      // The reset was already confirmed-delivered by the middleware pull, so
      // getInitializationOptions must NOT re-deliver it as {value:null, changed:true}.
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
        persistStub,
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
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

  // ── Outbound reset self-cancel guard (IDE-2149, historical) ──
  //
  // ORIGINAL bug: the onDidChangeConfiguration listener (registered in
  // registerExplicitKeyMarkingListener) used to call markExplicitlyChanged for ANY snyk.*
  // setting change — including the change triggered by a reset's own updateConfiguration
  // write — which could cancel a still-pending reset depending on event-arrival ordering.
  // Fixed first via a write-time tag, then [IDE-2264 ticket 04] superseded that tag entirely,
  // and [IDE-2264 ticket 09] deleted the tracker outright: the listener writes only to the
  // explicit-overrides map (via markExplicitLsKeysFromConfigurationChangeEvent).
  // The whole adversarial-ordering class this suite exists to guard against is therefore
  // structurally impossible now, independent of ordering.
  suite('outbound reset self-cancel guard (adversarial onDidChangeConfiguration ordering)', () => {
    function makeLanguageServerWithListener(
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
        sinon.stub().resolves(),
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );
    }

    // The outbound save path now records a reset directly in the explicit-overrides map
    // (ConfigurationPersistenceService.applyOutboundGlobalResets). Nothing wires the
    // onDidChangeConfiguration listener to the explicit-overrides map, so a genuinely delayed
    // dispatch has nothing to interfere with — this adversarial-ordering class of bug is now
    // structurally impossible for the outbound leg.
    test('a change event delayed past the write does not affect the explicit-overrides reset entry', async () => {
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
        explicitOverridesMap,
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );

      const ls = makeLanguageServerWithListener(fn => {
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
        sinon.stub().resolves(),
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
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
        sinon.stub().resolves(),
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
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
        sinon.stub().resolves(),
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
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
        sinon.stub().resolves(),
        undefined,
        new ExplicitOverridesMap(makeMemento()),
        new LastKnownValueCache({} as IVSCodeWorkspace, []),
      );
      downloadServiceMock.downloadReady$.next();

      await languageServer.start();

      sinon.assert.calledOnceWithExactly(commands.executeCommand, 'snyk.settings');
    });
  });
});
