import assert from 'assert';
import sinon from 'sinon';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  ResponseError,
  ShowDocumentParams,
  ShowDocumentRequestHandlerSignature,
} from '../../../../snyk/common/vscode/types';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import {
  LspConfigurationParam,
  ShowIssueDetailTopicParams,
  LsScanProduct,
  SnykURIAction,
} from '../../../../snyk/common/languageServer/types';
import { Subject } from 'rxjs';
import { LoggerMockFailOnErrors } from '../../mocks/logger.mock';

suite('Language Server: Middleware', () => {
  let configuration: IConfiguration;

  setup(() => {
    configuration = {
      getAuthenticationMethod(): string {
        return 'oauth';
      },
      shouldReportErrors: false,
      snykApiEndpoint: 'https://dev.snyk.io/api',
      getAdditionalCliParameters: () => '',
      organization: 'org',
      getToken: () => Promise.resolve('token'),
      isAutomaticDependencyManagementEnabled: () => true,
      getCliPath: (): Promise<string> => Promise.resolve('/path/to/cli'),
      getCliBaseDownloadUrl: () => 'https://downloads.snyk.io',
      getInsecure(): boolean {
        return true;
      },
      getDeltaFindingsEnabled(): boolean {
        return false;
      },
      getPreviewFeatures() {
        return {};
      },
      getOssQuickFixCodeActionsEnabled(): boolean {
        return true;
      },
      getFeaturesConfiguration() {
        return defaultFeaturesConfigurationStub;
      },
      severityFilter: DEFAULT_SEVERITY_FILTER,
      riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
      issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
      getTrustedFolders: () => ['/trusted/test/folder'],
      getFolderConfigs(): FolderConfig[] {
        return [];
      },
      getSecureAtInceptionExecutionFrequency(): string {
        return 'Manual';
      },
      getAutoConfigureMcpServer(): boolean {
        return false;
      },
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Configuration request should translate settings', async () => {
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return [{}];
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (res instanceof Error) {
      assert.fail('Handler returned an error');
    }

    const pullResponse = res[0] as { settings: LspConfigurationParam };
    assert(pullResponse.settings, 'Response should have settings');
    const settings = pullResponse.settings.settings!;
    assert.strictEqual(settings[LS_KEY.snykCodeEnabled]?.value, true);
    assert.strictEqual(settings[LS_KEY.snykOssEnabled]?.value, false);
    assert.strictEqual(settings[LS_KEY.snykIacEnabled]?.value, true);
    assert.strictEqual(settings[LS_KEY.snykSecretsEnabled]?.value, false);
    assert.strictEqual(settings[LS_KEY.apiEndpoint]?.value, configuration.snykApiEndpoint);
    assert.strictEqual(settings[LS_KEY.organization]?.value, `${configuration.organization}`);
    assert.strictEqual(settings[LS_KEY.sendErrorReports]?.value, false);
    assert.strictEqual(settings[LS_KEY.automaticDownload]?.value, true);
    assert.strictEqual(settings[LS_KEY.cliPath]?.value, await configuration.getCliPath());
    assert.strictEqual(settings[LS_KEY.trustEnabled]?.value, true);
  });

  test('Configuration request should return an error', async () => {
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return new Error('test err') as ResponseError;
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (!(res instanceof Error)) {
      console.log(res);
      assert.fail("Handler didn't return an error");
    }
  });

  test(`Snyk URI for action=${SnykURIAction.ShowInDetailPanel} should trigger show issue detail topic publish`, async () => {
    const product = LsScanProduct.Code;
    const issueId = '123abc456';

    const showIssueDetailTopic$ = new Subject<ShowIssueDetailTopicParams>();
    const subscribedTopicMessageRecieved = new Promise<ShowIssueDetailTopicParams>(resolve => {
      let calledAlready = false;
      showIssueDetailTopic$.subscribe(showIssueDetailTopicParams => {
        assert.strictEqual(calledAlready, false, 'Show issue detail topic published to multiple times');
        calledAlready = true;
        resolve(showIssueDetailTopicParams);
      });
    });

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      {} as IConfiguration,
      showIssueDetailTopic$,
      {} as IUriAdapter,
      {} as IVSCodeCommands,
    );
    const params: ShowDocumentParams = {
      uri: `snyk:///fake/file/path?product=${product.replaceAll(' ', '+')}&issueId=${issueId}&action=${
        SnykURIAction.ShowInDetailPanel
      }`,
    };
    const failOnNextHandler: ShowDocumentRequestHandlerSignature = (_params, _token) => {
      return { success: false };
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const res = await middleware.window.showDocument?.(params, failOnNextHandler);
    if (res === undefined) {
      assert.fail('Failed to call showDocument');
    }
    if (res instanceof Error) {
      assert.fail('Handler returned an error');
    }
    assert.deepStrictEqual(res, { success: true });

    const showIssueDetailTopicParams = await subscribedTopicMessageRecieved;
    assert.deepStrictEqual(showIssueDetailTopicParams, {
      product,
      issueId,
    });
  });

  test('didChangeConfiguration calls next when not suppressed', async () => {
    const nextStub = sinon.stub().resolves();
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
      undefined,
      undefined,
      () => false,
    );

    await middleware.workspace.didChangeConfiguration!.call(undefined, ['snyk'], nextStub);
    sinon.assert.calledOnceWithExactly(nextStub, ['snyk']);
  });

  test('didChangeConfiguration skips next when inbound persistence is active', async () => {
    const nextStub = sinon.stub().resolves();
    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
      undefined,
      undefined,
      () => true,
    );

    await middleware.workspace.didChangeConfiguration!.call(undefined, ['snyk'], nextStub);
    sinon.assert.notCalled(nextStub);
  });

  test('unmarks explicitly changed keys after emitting a reset (value: null)', async () => {
    const unmarkStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      unmarkExplicitlyChanged: unmarkStub,
      isExplicitlyChanged: (key: string) => key === LS_KEY.organization,
    };

    // organization is explicitly changed but value is null → triggers reset (value: null, changed: true)
    const configWithNullOrg = {
      ...configuration,
      organization: null as unknown as string,
    } as IConfiguration;

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configWithNullOrg,
      new Subject<ShowIssueDetailTopicParams>(),
      {} as IUriAdapter,
      {} as IVSCodeCommands,
      undefined,
      tracker,
    );

    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => [{}];
    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    await middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler);

    assert(unmarkStub.calledWith(LS_KEY.organization), 'Should unmark organization after reset');
  });
});
