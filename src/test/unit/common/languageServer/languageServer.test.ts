/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import assert, { deepStrictEqual } from 'assert';
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

suite('Language Server', () => {
  const authService = {} as IAuthenticationService;
  const user = new User(v4(), undefined);

  let configuration: IConfiguration;
  let languageServer: LanguageServer;
  let downloadService: DownloadService;
  setup(() => {
    configuration = {
      getCliPath(): string | undefined {
        return 'testPath';
      },
      getToken(): Promise<string | undefined> {
        return Promise.resolve('testToken');
      },
      shouldReportEvents: true,
      shouldReportErrors: true,
      getSnykLanguageServerPath(): string {
        return 'testPath';
      },
      getAdditionalCliParameters() {
        return '--all-projects';
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
    } as IConfiguration;

    downloadService = {
      downloadReady$: new ReplaySubject<void>(1),
    } as DownloadService;
  });

  teardown(() => {
    sinon.restore();
  });

  test('LanguageServer should provide correct initialization options', async () => {
    languageServer = new LanguageServer(
      user,
      configuration,
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
    };

    deepStrictEqual(await languageServer.getInitializationOptions(), expectedInitializationOptions);
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
          onReady(): Promise<void> {
            return Promise.resolve();
          },
        } as unknown as LanguageClient;
      },
    });

    languageServer = new LanguageServer(
      user,
      configuration,
      lca as unknown as ILanguageClientAdapter,
      stubWorkspaceConfiguration('http.proxy', expectedProxy),
      windowMock,
      authService,
      new LoggerMock(),
      downloadService,
    );
    downloadService.downloadReady$.next();
    await languageServer.start();
    sinon.assert.called(lca.create);
    sinon.verify();
  });
});
