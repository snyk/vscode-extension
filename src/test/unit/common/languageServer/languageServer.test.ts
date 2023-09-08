/* eslint-disable @typescript-eslint/no-empty-function */
import assert, { deepStrictEqual, fail, strictEqual } from 'assert';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { v4 } from 'uuid';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { InitializationOptions } from '../../../../snyk/common/languageServer/settings';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { User } from '../../../../snyk/common/user';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import * as fs from 'fs';

suite('Language Server', () => {
  const authServiceMock = {} as IAuthenticationService;
  const user = new User(v4(), undefined, new LoggerMock());

  let configurationMock: IConfiguration;
  let languageServer: LanguageServer;
  let downloadServiceMock: DownloadService;
  const path = 'testPath';
  const logger = {
    info(_msg: string) {},
    warn(_msg: string) {},
    log(_msg: string) {},
    error(msg: string) {
      fail(msg);
    },
  } as unknown as LoggerMock;

  setup(() => {
    configurationMock = {
      getInsecure(): boolean {
        return true;
      },
      getCliPath(): string | undefined {
        return path;
      },
      getToken(): Promise<string | undefined> {
        return Promise.resolve('testToken');
      },
      shouldReportEvents: true,
      shouldReportErrors: true,
      getSnykLanguageServerPath(): string {
        try {
          fs.statSync(path);
        } catch (_) {
          fs.writeFileSync(path, 'huhu');
        }
        return path;
      },
      getAdditionalCliParameters() {
        return '--all-projects -d';
      },
      isAutomaticDependencyManagementEnabled() {
        return true;
      },
      getPreviewFeatures() {
        return {
          advisor: false,
          reportFalsePositives: false,
        };
      },
      getFeaturesConfiguration() {
        return defaultFeaturesConfigurationStub;
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
      scanningMode: 'auto',
    } as IConfiguration;

    downloadServiceMock = {
      downloadReady$: new ReplaySubject<void>(1),
    } as DownloadService;
  });

  teardown(() => {
    fs.rmSync(path, { force: true });
    sinon.restore();
  });

  test('LanguageServer (standalone) starts with correct args', async () => {
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
            assert.strictEqual('args' in serverOptions ? serverOptions?.args?.[0] : '', '-l');
            assert.strictEqual('args' in serverOptions ? serverOptions?.args?.[1] : '', 'debug');
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
      {
        info(_msg: string) {},
        warn(_msg: string) {},
        log(_msg: string) {},
        error(msg: string) {
          fail(msg);
        },
      } as unknown as LoggerMock,
      downloadServiceMock,
    );
    downloadServiceMock.downloadReady$.next();

    await languageServer.start();
    sinon.assert.called(lca.create);
    sinon.verify();
  });

  test('LanguageServer (embedded) starts with language-server arg', async () => {
    configurationMock.getSnykLanguageServerPath = () => {
      try {
        fs.statSync(path);
      } catch (_) {
        // write >50MB of data to simulate a CLI sized binary
        let data = '';
        const size = 55 * 128 * 1024; // 128 * 8 = 1024 bytes, 55 * 1024 * 1024 = 55MB
        for (let i = 0; i < size; i++) {
          data += '01234567';
        }
        fs.writeFileSync(path, data);
      }
      return path;
    };
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
    );
    downloadServiceMock.downloadReady$.next();
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
      );
    });

    test('LanguageServer should provide correct initialization options', async () => {
      const expectedInitializationOptions: InitializationOptions = {
        activateSnykCodeSecurity: 'true',
        activateSnykCodeQuality: 'true',
        activateSnykOpenSource: 'false',
        activateSnykIac: 'true',
        token: 'testToken',
        cliPath: 'testPath',
        enableTelemetry: 'true',
        sendErrorReports: 'true',
        integrationName: 'VS_CODE',
        integrationVersion: '0.0.0',
        automaticAuthentication: 'false',
        endpoint: undefined,
        organization: undefined,
        additionalParams: '--all-projects',
        manageBinariesAutomatically: 'true',
        deviceId: user.anonymousId,
        filterSeverity: { critical: true, high: true, medium: true, low: true },
        enableTrustedFoldersFeature: 'true',
        trustedFolders: ['/trusted/test/folder'],
        insecure: 'true',
        scanningMode: 'auto',
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
      );

      const initOptions = await languageServer.getInitializationOptions();

      strictEqual(initOptions.activateSnykCodeQuality, `true`);
      strictEqual(initOptions.activateSnykCodeQuality, `true`);
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
