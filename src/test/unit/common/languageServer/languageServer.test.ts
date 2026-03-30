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
import {
  PFLAG,
  serverSettingsToLspInitializationOptions,
} from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { ServerSettings } from '../../../../snyk/common/languageServer/settings';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { User } from '../../../../snyk/common/user';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMock, LoggerMockFailOnErrors } from '../../mocks/logger.mock';
import { WindowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import { DEFAULT_LS_DEBOUNCE_INTERVAL } from '../../../../snyk/common/constants/general';
import { DID_CHANGE_CONFIGURATION_METHOD, PROTOCOL_VERSION } from '../../../../snyk/common/constants/languageServer';
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

  function createWorkspaceConfigurationProviderWithInboundSpy(): {
    inboundSpy: sinon.SinonSpy;
    workspaceConfigurationProvider: IWorkspaceConfigurationWebviewProvider;
  } {
    const inboundSpy = sinon.spy();
    return {
      inboundSpy,
      workspaceConfigurationProvider: {
        showPanel: sinon.stub().resolves(),
        disposePanel: sinon.stub(),
        setAuthToken: sinon.stub(),
        onInboundLspConfigurationUpdated: inboundSpy,
      },
    };
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
                PFLAG.token
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

  test('sends structured workspace/didChangeConfiguration when snyk settings change (debounced)', async () => {
    const sendNotification = sinon.stub().resolves();
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const adapter = {
      create(): LanguageClient {
        return {
          start: sinon.stub().resolves(),
          onNotification(): void {
            return;
          },
          onReady: sinon.stub().resolves(),
          sendNotification,
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

    languageServer = createFakeLanguageServer(adapter, workspace);
    downloadServiceMock.downloadReady$.next();
    const clock = sinon.useFakeTimers();
    try {
      await languageServer.start();
      await clock.tickAsync(0);
      sinon.assert.calledOnce(sendNotification);
      strictEqual(sendNotification.getCall(0).args[0], DID_CHANGE_CONFIGURATION_METHOD);
      sendNotification.resetHistory();
      configListener({ affectsConfiguration: (s: string) => s === 'snyk' });
      await clock.tickAsync(DEFAULT_LS_DEBOUNCE_INTERVAL);
      sinon.assert.calledOnce(sendNotification);
      strictEqual(sendNotification.getCall(0).args[0], DID_CHANGE_CONFIGURATION_METHOD);
      const payload = sendNotification.getCall(0).args[1] as { settings: { settings?: Record<string, unknown> } };
      assert(payload.settings?.settings !== undefined);
    } finally {
      clock.restore();
    }
  });

  test('does not send didChangeConfiguration when only non-snyk configuration changes', async () => {
    const sendNotification = sinon.stub().resolves();
    let configListener: (e: { affectsConfiguration: (s: string) => boolean }) => void = () => {};
    const adapter = {
      create(): LanguageClient {
        return {
          start: sinon.stub().resolves(),
          onNotification(): void {
            return;
          },
          onReady: sinon.stub().resolves(),
          sendNotification,
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

    languageServer = createFakeLanguageServer(adapter, workspace);
    downloadServiceMock.downloadReady$.next();
    const clock = sinon.useFakeTimers();
    try {
      await languageServer.start();
      await clock.tickAsync(0);
      sinon.assert.calledOnce(sendNotification);
      sendNotification.resetHistory();
      configListener({ affectsConfiguration: () => false });
      await clock.tickAsync(DEFAULT_LS_DEBOUNCE_INTERVAL);
      sinon.assert.notCalled(sendNotification);
    } finally {
      clock.restore();
    }
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
          {
            folderPath: '/test/path',
            baseBranch: 'main',
            localBranches: ['main', 'develop'],
            referenceFolderPath: undefined,
            preferredOrg: 'irrelevant-org',
            orgSetByUser: true,
            autoDeterminedOrg: 'irrelevant-org',
            orgMigratedFromGlobalConfig: true,
          },
        ],
      },
    ];
    tcs.forEach(tc => {
      test(tc.name, async () => {
        configurationMock.getFolderConfigs = () => tc.folderConfigs;

        const expectedFlat: ServerSettings = {
          activateSnykCodeSecurity: 'true',
          enableDeltaFindings: 'false',
          activateSnykOpenSource: 'false',
          activateSnykIac: 'true',
          activateSnykSecrets: 'false',
          token: 'testToken',
          cliPath: 'testPath',
          cliBaseDownloadURL: 'https://downloads.snyk.io',
          sendErrorReports: 'true',
          integrationName: 'VS_CODE',
          integrationVersion: '0.0.0',
          automaticAuthentication: 'false',
          endpoint: undefined,
          organization: undefined,
          additionalParams: '--all-projects -d',
          manageBinariesAutomatically: 'true',
          deviceId: user.anonymousId,
          filterSeverity: DEFAULT_SEVERITY_FILTER,
          riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
          issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
          enableTrustedFoldersFeature: 'true',
          trustedFolders: ['/trusted/test/folder'],
          insecure: 'true',
          requiredProtocolVersion: PROTOCOL_VERSION.toString(),
          scanningMode: 'auto',
          folderConfigs: tc.folderConfigs,
          authenticationMethod: 'oauth',
          enableSnykOSSQuickFixCodeActions: 'true',
          hoverVerbosity: 1,
          secureAtInceptionExecutionFrequency: 'Manual',
          autoConfigureSnykMcpServer: 'false',
        };

        const initializationOptions = await languageServer.getInitializationOptions();
        deepStrictEqual(initializationOptions, serverSettingsToLspInitializationOptions(expectedFlat));
      });
    });

    test('LanguageServer should respect experiment setup for Code', async () => {
      const initOptions = await languageServer.getInitializationOptions();

      strictEqual(initOptions.settings[PFLAG.snykCodeEnabled]?.value, true);
    });

    ['auto', 'manual'].forEach(expectedScanningMode => {
      test(`scanningMode is set to ${expectedScanningMode}`, async () => {
        configurationMock.scanningMode = expectedScanningMode;
        const options = await languageServer.getInitializationOptions();

        assert.strictEqual(options.settings[PFLAG.scanAutomatic]?.value, expectedScanningMode !== 'manual');
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
    let syncLoggedInFromStoredTokenStub: sinon.SinonStub;

    setup(() => {
      syncLoggedInFromStoredTokenStub = sinon.stub().resolves();
      authServiceMock.syncLoggedInContextFromStoredTokenIfValid = syncLoggedInFromStoredTokenStub;
    });

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
      sinon.assert.calledOnce(syncLoggedInFromStoredTokenStub);
      deepStrictEqual(languageServer.getInboundLspConfigurationView(), {
        globalSettings: {
          [endpointKey]: {
            value: 'https://api.dev.snyk.io',
            source: 'default',
            isLocked: false,
          },
        },
        folderSettingsByPath: {},
      });
      debugSpy.restore();
    });

    test('Forwards merged inbound config to workspace configuration provider', async () => {
      const { inboundSpy, workspaceConfigurationProvider } = createWorkspaceConfigurationProviderWithInboundSpy();

      const { notificationHandlers } = await startLanguageServerWithRecordingClient({
        workspaceConfigurationProvider,
      });

      const handler = notificationHandlers['$/snyk.configuration'];
      assert(handler, 'snyk.configuration notification handler should be registered');

      handler({
        settings: {
          endpoint: { value: 'https://api.snyk.io', source: 'default', isLocked: false },
        },
        folderConfigs: [
          {
            folderPath: '/proj/a',
            settings: { activateSnykCode: { value: true, source: 'user-override', isLocked: false } },
          },
        ],
      });

      sinon.assert.calledOnce(syncLoggedInFromStoredTokenStub);
      sinon.assert.calledOnce(inboundSpy);
      deepStrictEqual(inboundSpy.getCall(0).args[0], languageServer.getInboundLspConfigurationView());
    });

    test('Defers inbound push while folderConfigs org update is in progress', async () => {
      const { inboundSpy, workspaceConfigurationProvider } = createWorkspaceConfigurationProviderWithInboundSpy();

      const { notificationHandlers } = await startLanguageServerWithRecordingClient({
        workspaceConfigurationProvider,
      });

      const handler = notificationHandlers['$/snyk.configuration'];
      assert(handler, 'snyk.configuration notification handler should be registered');

      const folderPath = '/workspace/folder-a';
      LanguageServer.clearLSUpdatingOrgState();
      LanguageServer.beginLSOrgUpdateFromFolderConfigsForTests(folderPath);

      handler({
        settings: { endpoint: { value: 'https://api.snyk.io', source: 'default', isLocked: false } },
      });

      sinon.assert.calledOnce(syncLoggedInFromStoredTokenStub);
      sinon.assert.notCalled(inboundSpy);

      LanguageServer.endLSOrgUpdateFromFolderConfigsForTests(folderPath);

      for (let i = 0; i < 20; i++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }

      sinon.assert.calledOnce(inboundSpy);
      deepStrictEqual(inboundSpy.getCall(0).args[0], languageServer.getInboundLspConfigurationView());
    });
  });
});
