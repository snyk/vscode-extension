import assert, { deepStrictEqual, strictEqual } from 'assert';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { v4 } from 'uuid';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
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

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;

  const path = 'testPath';
  const logger = new LoggerMockFailOnErrors();

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
        return Promise.resolve(path);
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
      issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
      getTrustedFolders(): string[] {
        return ['/trusted/test/folder'];
      },
      getFolderConfigs(): FolderConfig[] {
        return [];
      },
      scanningMode: 'auto',
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
        } as unknown as LanguageClient;
      },
    });

    languageServer = new LanguageServer(
      user,
      configurationMock,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('snyk.loglevel', 'trace'),
      windowMock,
      authServiceMock,
      logger,
      downloadServiceMock,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      {} as IVSCodeCommands,
      {} as IDiagnosticsIssueProvider<unknown>,
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
            assert.strictEqual(id, 'Snyk LS');
            assert.strictEqual(name, 'Snyk Language Server');
            assert.strictEqual(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              'options' in serverOptions ? serverOptions?.options?.env?.http_proxy : undefined,
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
        } as unknown as LanguageClient;
      },
    });

    languageServer = new LanguageServer(
      user,
      configurationMock,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', expectedProxy),
      windowMock,
      authServiceMock,
      new LoggerMock(),
      downloadServiceMock,
      {} as IExtensionRetriever,
      {} as ISummaryProviderService,
      {} as IUriAdapter,
      {} as IMarkdownStringAdapter,
      {} as IVSCodeCommands,
      {} as IDiagnosticsIssueProvider<unknown>,
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
      languageServer = new LanguageServer(
        user,
        configurationMock,
        mockLanguageClientAdapter,
        {} as IVSCodeWorkspace,
        windowMock,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        {} as IVSCodeCommands,
        {} as IDiagnosticsIssueProvider<unknown>,
      );
    });

    test('LanguageServer should provide empty folder configs when no folder configs were received', async () => {
      const expectedInitializationOptions: ServerSettings = {
        activateSnykCodeSecurity: 'true',
        enableDeltaFindings: 'false',
        activateSnykOpenSource: 'false',
        activateSnykIac: 'true',
        token: 'testToken',
        cliPath: 'testPath',
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
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        enableTrustedFoldersFeature: 'true',
        trustedFolders: ['/trusted/test/folder'],
        insecure: 'true',
        requiredProtocolVersion: PROTOCOL_VERSION.toString(),
        scanningMode: 'auto',
        folderConfigs: [],
        authenticationMethod: 'oauth',
        enableSnykOSSQuickFixCodeActions: 'true',
        hoverVerbosity: 1,
      };

      deepStrictEqual(await languageServer.getInitializationOptions(), expectedInitializationOptions);
    });

    test('LanguageServer should include folder configs when they have been received from language server', async () => {
      // Setup a sample folder config
      const sampleFolderConfig: FolderConfig = {
        folderPath: '/test/path',
        baseBranch: 'main',
        localBranches: ['main', 'develop'],
        referenceFolderPath: undefined,
      };
      configurationMock.getFolderConfigs = () => [sampleFolderConfig];

      // Simulate language server notification about folder configs
      // This is normally done in the registerListeners method when receiving a notification
      // Access private field via type assertion to LanguageServer with private field type
      LanguageServer.ReceivedFolderConfigsFromLs = true;

      // Create expected initialization options with the folder config included
      const expectedInitializationOptions: ServerSettings = {
        activateSnykCodeSecurity: 'true',
        enableDeltaFindings: 'false',
        activateSnykOpenSource: 'false',
        activateSnykIac: 'true',
        token: 'testToken',
        cliPath: 'testPath',
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
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        enableTrustedFoldersFeature: 'true',
        trustedFolders: ['/trusted/test/folder'],
        insecure: 'true',
        requiredProtocolVersion: PROTOCOL_VERSION.toString(),
        scanningMode: 'auto',
        folderConfigs: [sampleFolderConfig],
        authenticationMethod: 'oauth',
        enableSnykOSSQuickFixCodeActions: 'true',
        hoverVerbosity: 1,
      };
      const initializationOptions = await languageServer.getInitializationOptions();
      LanguageServer.ReceivedFolderConfigsFromLs = false;
      deepStrictEqual(initializationOptions, expectedInitializationOptions);
    });

    test('LanguageServer should respect experiment setup for Code', async () => {
      languageServer = new LanguageServer(
        user,
        configurationMock,
        {} as ILanguageClientAdapter,
        {} as IVSCodeWorkspace,
        windowMock,
        authServiceMock,
        new LoggerMock(),
        downloadServiceMock,
        {} as IExtensionRetriever,
        {} as ISummaryProviderService,
        {} as IUriAdapter,
        {} as IMarkdownStringAdapter,
        {} as IVSCodeCommands,
        {} as IDiagnosticsIssueProvider<unknown>,
      );

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
});
