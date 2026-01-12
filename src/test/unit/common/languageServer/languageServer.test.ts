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
import { ServerSettings } from '../../../../snyk/common/languageServer/settings';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { User } from '../../../../snyk/common/user';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMock, LoggerMockFailOnErrors } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import { PROTOCOL_VERSION } from '../../../../snyk/common/constants/languageServer';
import { IExtensionRetriever } from '../../../../snyk/common/vscode/extensionContext';
import { ISummaryProviderService } from '../../../../snyk/base/summary/summaryProviderService';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { IMarkdownStringAdapter } from '../../../../snyk/common/vscode/markdownString';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IDiagnosticsIssueProvider } from '../../../../snyk/common/services/diagnosticsService';
import { IMcpProvider } from '../../../../snyk/common/vscode/mcpProvider';

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;

  const logger = new LoggerMockFailOnErrors();

  const createFakeLanguageServer = (languageClientAdapter: ILanguageClientAdapter, workspace: IVSCodeWorkspace) => {
    return new LanguageServer(
      user,
      configurationMock,
      languageClientAdapter,
      workspace,
      windowMock,
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IMcpProvider,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      {} as IVSCodeCommands,
      {} as IDiagnosticsIssueProvider<unknown>,
    );
  };

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
          outputChannel: {
            show(): void {
              return;
            },
          },
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
    sinon.verify();
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            assert.strictEqual(clientOptions.initializationOptions.token, 'testToken');
            return Promise.resolve();
          },
          onNotification(): void {
            return;
          },
          onReady(): Promise<void> {
            return Promise.resolve();
          },
          outputChannel: {
            show(): void {
              return;
            },
          },
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
    sinon.verify();
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

    teardown(() => {
      LanguageServer.ReceivedFolderConfigsFromLs = false;
    });

    const tcs: {
      name: string;
      folderConfigs: FolderConfig[];
      simulateReceivedFolderConfigsFromLs: boolean;
    }[] = [
      {
        name: 'LanguageServer should provide empty folder configs when no folder configs were received (first init)',
        folderConfigs: [],
        simulateReceivedFolderConfigsFromLs: false,
      },
      {
        name: 'LanguageServer should include folder configs when they have been received from language server (LS restarts)',
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
        simulateReceivedFolderConfigsFromLs: true,
      },
    ];
    tcs.forEach(tc => {
      test(tc.name, async () => {
        // Setup folder configs mock
        configurationMock.getFolderConfigs = () => tc.folderConfigs;

        // Simulate language server notification about folder configs
        // This is normally done in the registerListeners method when receiving a notification
        LanguageServer.ReceivedFolderConfigsFromLs = tc.simulateReceivedFolderConfigsFromLs;

        const expectedInitializationOptions: ServerSettings = {
          activateSnykCodeSecurity: 'true',
          enableDeltaFindings: 'false',
          activateSnykOpenSource: 'false',
          activateSnykIac: 'true',
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
        deepStrictEqual(initializationOptions, expectedInitializationOptions);
      });
    });

    test('LanguageServer should respect experiment setup for Code', async () => {
      const initOptions = await languageServer.getInitializationOptions();

      strictEqual(initOptions.activateSnykCodeSecurity, `true`);
    });

    ['auto', 'manual'].forEach(expectedScanningMode => {
      test(`scanningMode is set to ${expectedScanningMode}`, async () => {
        configurationMock.scanningMode = expectedScanningMode;
        const options = await languageServer.getInitializationOptions();

        assert.strictEqual(options.scanningMode, expectedScanningMode);
      });
    });
  });

  suite('handleOrgSettingsFromFolderConfigs', () => {
    let getWorkspaceFoldersStub: sinon.SinonStub;
    let workspaceMock: IVSCodeWorkspace;
    let setOrganizationStub: sinon.SinonStub;
    let setAutoSelectOrganizationStub: sinon.SinonStub;
    let isAutoSelectOrganizationEnabledStub: sinon.SinonStub;
    let languageClientAdapter: ILanguageClientAdapter;
    const AUTO_DETERMINED_ORG = 'auto-determined-org';

    setup(() => {
      setOrganizationStub = sinon.stub().resolves();
      configurationMock.setOrganization = setOrganizationStub;
      setAutoSelectOrganizationStub = sinon.stub().resolves();
      configurationMock.setAutoSelectOrganization = setAutoSelectOrganizationStub;
      isAutoSelectOrganizationEnabledStub = sinon.stub();
      configurationMock.isAutoSelectOrganizationEnabled = isAutoSelectOrganizationEnabledStub;

      languageClientAdapter = {
        create: sinon.stub(),
      } as unknown as ILanguageClientAdapter;

      getWorkspaceFoldersStub = sinon.stub();
      workspaceMock = {
        getWorkspaceFolders: getWorkspaceFoldersStub,
      } as unknown as IVSCodeWorkspace;

      languageServer = createFakeLanguageServer(languageClientAdapter, workspaceMock);
    });

    const createFolderConfig = (folderPath: string, preferredOrg: string, orgSetByUser: boolean): FolderConfig => ({
      folderPath,
      baseBranch: 'main',
      localBranches: undefined,
      referenceFolderPath: undefined,
      preferredOrg,
      orgSetByUser,
      autoDeterminedOrg: AUTO_DETERMINED_ORG,
      orgMigratedFromGlobalConfig: true,
    });

    test('should set org settings from LS folder configs (when contains orgSetByUser as true)', async () => {
      const testCases = [
        {
          // User unticked the "Auto-select organization" checkbox, so preferredOrg was blanked by LS
          folderPath: '/path/to/folder1',
          preferredOrg: '',
        },
        {
          // User wrote in an org name manually, so orgSetByUser was set to true by LS
          folderPath: '/path/to/folder2',
          preferredOrg: 'org-for-folder2',
        },
      ];

      const workspaceFolders = testCases.map(tc => ({ uri: { fsPath: tc.folderPath } }));
      getWorkspaceFoldersStub.returns(workspaceFolders);
      isAutoSelectOrganizationEnabledStub.returns(true);

      const folderConfigs = testCases.map(tc => createFolderConfig(tc.folderPath, tc.preferredOrg, true));

      await languageServer['handleOrgSettingsFromFolderConfigs'](folderConfigs);

      strictEqual(setOrganizationStub.callCount, testCases.length);
      strictEqual(setAutoSelectOrganizationStub.callCount, testCases.length);
      testCases.forEach((tc, index) => {
        strictEqual(setOrganizationStub.getCall(index).args[0], workspaceFolders[index]);
        strictEqual(setOrganizationStub.getCall(index).args[1], tc.preferredOrg);
        strictEqual(setAutoSelectOrganizationStub.getCall(index).args[0], workspaceFolders[index]);
        strictEqual(setAutoSelectOrganizationStub.getCall(index).args[1], false);
      });
    });

    for (const currentAutoOrg of [true, false]) {
      test(`should set org settings at workspace folder level for folder configs from LS (when orgSetByUser is false regardless of previous auto-org status, currentAutoOrg=${currentAutoOrg})`, async () => {
        const workspaceFolder = { uri: { fsPath: '/path/to/folder' } };
        getWorkspaceFoldersStub.returns([workspaceFolder]);
        isAutoSelectOrganizationEnabledStub.returns(currentAutoOrg);

        const folderConfigs = [createFolderConfig('/path/to/folder', '', false)];

        await languageServer['handleOrgSettingsFromFolderConfigs'](folderConfigs);

        strictEqual(setOrganizationStub.callCount, 1);
        strictEqual(setOrganizationStub.getCall(0).args[0], workspaceFolder);
        strictEqual(setOrganizationStub.getCall(0).args[1], AUTO_DETERMINED_ORG);

        // We still write it to ensure it is set at the folder level
        strictEqual(setAutoSelectOrganizationStub.callCount, 1);
        strictEqual(setAutoSelectOrganizationStub.getCall(0).args[0], workspaceFolder);
        strictEqual(setAutoSelectOrganizationStub.getCall(0).args[1], true);
      });
    }

    test('should not set auto-org setting from LS folder configs (when already opted out of auto-org and orgSetByUser is true)', async () => {
      const testCases = [
        {
          // User blanked the org manually
          folderPath: '/path/to/folder1',
          preferredOrg: '',
        },
        {
          // User changed the org manually
          folderPath: '/path/to/folder2',
          preferredOrg: 'org-for-folder2',
        },
      ];

      const workspaceFolders = testCases.map(tc => ({ uri: { fsPath: tc.folderPath } }));
      getWorkspaceFoldersStub.returns(workspaceFolders);
      isAutoSelectOrganizationEnabledStub.returns(false);

      const folderConfigs = testCases.map(tc => createFolderConfig(tc.folderPath, tc.preferredOrg, true));

      await languageServer['handleOrgSettingsFromFolderConfigs'](folderConfigs);

      strictEqual(setOrganizationStub.callCount, testCases.length);
      strictEqual(setAutoSelectOrganizationStub.callCount, 0);
      testCases.forEach((tc, index) => {
        strictEqual(setOrganizationStub.getCall(index).args[0], workspaceFolders[index]);
        strictEqual(setOrganizationStub.getCall(index).args[1], tc.preferredOrg);
      });
    });

    test('should warn and skip folder configs without matching workspace folders', async () => {
      const workspaceFolder = { uri: { fsPath: '/path/to/existing/folder' } };
      getWorkspaceFoldersStub.returns([workspaceFolder]);
      isAutoSelectOrganizationEnabledStub.returns(true);

      const folderConfigs = [
        createFolderConfig('/path/to/existing/folder', 'existing-org', true),
        createFolderConfig('/path/to/missing/folder', 'missing-org', true),
      ];

      const loggerWarnSpy = sinon.spy(logger, 'warn');
      await languageServer['handleOrgSettingsFromFolderConfigs'](folderConfigs);

      // Should only process the existing folder
      strictEqual(setOrganizationStub.callCount, 1);
      strictEqual(setOrganizationStub.getCall(0).args[0], workspaceFolder);
      strictEqual(setOrganizationStub.getCall(0).args[1], 'existing-org');

      strictEqual(setAutoSelectOrganizationStub.callCount, 1);
      strictEqual(setAutoSelectOrganizationStub.getCall(0).args[0], workspaceFolder);
      strictEqual(setAutoSelectOrganizationStub.getCall(0).args[1], false);

      // Should warn about the missing folder
      strictEqual(loggerWarnSpy.callCount, 1);
      strictEqual(loggerWarnSpy.getCall(0).args[0], 'No workspace folder found for path: /path/to/missing/folder');
    });
  });
});
