/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import assert, { deepStrictEqual } from 'assert';
import sinon from 'sinon';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { IConfiguration, PreviewFeatures } from '../../../../snyk/common/configuration/configuration';
import { LanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { InitializationOptions } from '../../../../snyk/common/languageServer/settings';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient, LanguageClientOptions, ServerOptions } from '../../../../snyk/common/vscode/types';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { extensionContextMock } from '../../mocks/extensionContext.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';
import { stubWorkspaceConfiguration } from '../../mocks/workspace.mock';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { ReplaySubject } from 'rxjs';

suite('Language Server', () => {
  const extensionContext = extensionContextMock;
  const authService = {} as IAuthenticationService;

  let configuration: IConfiguration;
  let contextService: IContextService;
  let languageServer: LanguageServer;
  let downloadService: DownloadService;
  setup(() => {
    configuration = {
      getCustomCliPath(): string | undefined {
        return 'testPath';
      },
      getToken(): Promise<string | undefined> {
        return Promise.resolve('testToken');
      },
      shouldReportEvents: true,
      shouldReportErrors: true,
      getPreviewFeatures(): PreviewFeatures {
        return {
          advisor: false,
          reportFalsePositives: false,
          lsAuthenticate: true,
        };
      },
      getSnykLanguageServerPath(): string {
        return 'testPath';
      },
      getAdditionalCliParameters() {
        return '--all-projects';
      },
      isAutomaticDependencyManagementEnabled() {
        return true;
      },
    } as IConfiguration;

    contextService = {
      setContext(_key, _value): Promise<void> {
        return Promise.resolve(undefined);
      },
    } as IContextService;
    downloadService = {
      downloadReady: new ReplaySubject<void>(1),
    } as DownloadService;
  });

  teardown(() => {
    sinon.restore();
  });

  test('LanguageServer should provide correct initialization options', async () => {
    languageServer = new LanguageServer(
      extensionContext,
      configuration,
      contextService,
      {} as ILanguageClientAdapter,
      {} as IVSCodeWorkspace,
      windowMock,
      authService,
      new LoggerMock(),
      downloadService,
    );
    const expectedInitializationOptions: InitializationOptions = {
      activateSnykCode: 'false',
      activateSnykOpenSource: 'false',
      activateSnykIac: 'false',
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
    };

    deepStrictEqual(await languageServer.getInitializationOptions(), expectedInitializationOptions);
  });

  test('LanguageServer starts language client if preview enabled', async () => {
    const lc = sinon.spy({
      start(): Promise<void> {
        return Promise.resolve();
      },
      onNotification(): void {
        return;
      },
    } as unknown as LanguageClient);

    const lca = sinon.spy({
      create(): LanguageClient {
        return lc as unknown as LanguageClient;
      },
    });

    languageServer = new LanguageServer(
      extensionContext,
      configuration,
      contextService,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', undefined),
      windowMock,
      authService,
      new LoggerMock(),
      downloadService,
    );
    downloadService.downloadReady.next();

    await languageServer.start();
    sinon.assert.called(lca.create);
    sinon.assert.called(lc.start);
  });

  test('LanguageServer does not start language client if preview not enabled', async () => {
    const lca = sinon.stub();
    sinon.stub(configuration, 'getPreviewFeatures').returns({
      advisor: false,
      reportFalsePositives: false,
      lsAuthenticate: false,
    });

    languageServer = new LanguageServer(
      extensionContext,
      configuration,
      contextService,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', undefined),
      windowMock,
      authService,
      new LoggerMock(),
      downloadService,
    );

    await languageServer.start();
    sinon.assert.notCalled(lca);
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
              'options' in serverOptions ? serverOptions?.options?.env?.http_proxy : undefined,
              expectedProxy,
            );
            assert.strictEqual(clientOptions.initializationOptions.token, 'testToken');
            return Promise.resolve();
          },
          onNotification(): void {
            return;
          },
        } as unknown as LanguageClient;
      },
    });

    languageServer = new LanguageServer(
      extensionContext,
      configuration,
      contextService,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', expectedProxy),
      windowMock,
      authService,
      new LoggerMock(),
      downloadService,
    );
    downloadService.downloadReady.next();
    await languageServer.start();
    sinon.assert.called(lca.create);
    sinon.verify();
  });
});
