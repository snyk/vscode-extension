/* eslint-disable @typescript-eslint/no-empty-function */
import assert, { deepStrictEqual, fail, strictEqual } from 'assert';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { v4 } from 'uuid';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { FolderConfig, IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { ServerSettings } from '../../../../snyk/common/languageServer/settings';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { User } from '../../../../snyk/common/user';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import { PROTOCOL_VERSION } from '../../../../snyk/common/constants/languageServer';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { ISummaryProviderService } from '../../../../snyk/base/summary/summaryProviderService';

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;
  let extensionContextMock: ExtensionContext;
  const path = 'testPath';
  const logger = {
    info(_msg: string) {},
    warn(_msg: string) {},
    log(_msg: string) {},
    error(msg: string) {
      fail(msg);
    },
  } as unknown as LoggerMock;

  let contextGetGlobalStateValue: sinon.SinonStub;

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
        return {
          advisor: false,
          ossQuickfixes: false,
        };
      },
      severityFilter: {
        critical: true,
        high: true,
        medium: true,
        low: true,
      },
      getTrustedFolders(): string[] {
        return ['/trusted/test/folder'];
      },
      getFolderConfigs(): FolderConfig[] {
        return [];
      },
      scanningMode: 'auto',
    } as IConfiguration;

    extensionContextMock = {
      extensionPath: 'test/path',
      getGlobalStateValue: contextGetGlobalStateValue,
      updateGlobalStateValue: sinon.fake(),
      setContext: sinon.fake(),
      subscriptions: [],
      addDisposables: sinon.fake(),
      getExtensionUri: sinon.fake(),
    } as unknown as ExtensionContext;

    downloadServiceMock = {
      downloadReady$: new ReplaySubject<void>(1),
    } as DownloadService;
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      extensionContextMock,
      {} as ISummaryProviderService,
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
      extensionContextMock,
      {} as ISummaryProviderService,
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
        extensionContextMock,
        {} as ISummaryProviderService,
      );
    });

    test('LanguageServer should provide correct initialization options', async () => {
      const expectedInitializationOptions: ServerSettings = {
        activateSnykCodeSecurity: 'true',
        activateSnykCodeQuality: 'true',
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
        filterSeverity: { critical: true, high: true, medium: true, low: true },
        enableTrustedFoldersFeature: 'true',
        trustedFolders: ['/trusted/test/folder'],
        insecure: 'true',
        requiredProtocolVersion: PROTOCOL_VERSION.toString(),
        scanningMode: 'auto',
        folderConfigs: [],
        authenticationMethod: 'oauth',
        enableSnykOSSQuickFixCodeActions: 'false',
        hoverVerbosity: 1,
      };

      deepStrictEqual(await languageServer.getInitializationOptions(), expectedInitializationOptions);
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
        extensionContextMock,
        {} as ISummaryProviderService,
      );

      const initOptions = await languageServer.getInitializationOptions();

      strictEqual(initOptions.activateSnykCodeQuality, `true`);
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
