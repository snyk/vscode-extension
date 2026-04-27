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
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
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

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;

  const logger = new LoggerMockFailOnErrors();

  const explicitLspConfigurationChangeTracker: IExplicitLspConfigurationChangeTracker = {
    markExplicitlyChanged: sinon.stub(),
    unmarkExplicitlyChanged: sinon.stub(),
    isExplicitlyChanged: () => true,
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
    );
    downloadServiceMock.downloadReady$.next();
    await languageServer.start();
    configListener({ affectsConfiguration: () => false });
    sinon.assert.notCalled(markStub);
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
});
