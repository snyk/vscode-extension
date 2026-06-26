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
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
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
      getAdditionalCliEnvironment: () => '',
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
    assert.deepStrictEqual(settings[LS_KEY.trustedFolders]?.value, ['/trusted/test/folder']);
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
      markPendingReset: sinon.stub(),
      consumePendingResets: sinon.stub().returns(new Set<string>()),
      committedSinceReset: () => false,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
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

  test('re-enqueues pending resets when fromConfiguration rejects', async () => {
    // Arrange: tracker with one pending reset key.
    const markPendingResetStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      unmarkExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: () => false,
      markPendingReset: markPendingResetStub,
      consumePendingResets: sinon.stub().returns(new Set<string>([LS_KEY.organization])),
      committedSinceReset: () => false,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
    };

    // Stub fromConfiguration to reject after consumePendingResets has drained the set.
    const fromConfigError = new Error('fromConfiguration failed');
    sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
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

    // Act + Assert: must throw (the error propagates), AND the key must be re-enqueued.
    await assert.rejects(
      async () => middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler),
      fromConfigError,
    );

    // The drained key must have been re-enqueued via markPendingReset so the next pull retries.
    sinon.assert.calledWith(markPendingResetStub, LS_KEY.organization);
  });

  test('does not re-enqueue a pending reset key that was explicitly changed during the await gap', async () => {
    // Arrange: two keys pending reset — 'organization' and 'cliPath'.
    // During the await gap the user re-edits 'organization' (markExplicitlyChanged is called for it),
    // which simulates the race: consumePendingResets drained the live set, so
    // pendingResets.delete was a no-op, but isExplicitlyChanged is now true for that key.
    const markPendingResetStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      unmarkExplicitlyChanged: sinon.stub(),
      // Simulate: 'organization' was re-edited during the await gap — it IS explicitly changed.
      // 'cliPath' was NOT re-edited — it is NOT explicitly changed.
      isExplicitlyChanged: (key: string) => key === LS_KEY.organization,
      markPendingReset: markPendingResetStub,
      consumePendingResets: sinon.stub().returns(new Set<string>([LS_KEY.organization, LS_KEY.cliPath])),
      committedSinceReset: (key: string) => key === LS_KEY.organization,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
    };

    const fromConfigError = new Error('fromConfiguration failed during race');
    sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
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

    await assert.rejects(
      async () => middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler),
      fromConfigError,
    );

    // 'cliPath' was NOT re-edited → must be re-enqueued so the next pull retries it.
    sinon.assert.calledWith(markPendingResetStub, LS_KEY.cliPath);
    // 'organization' WAS re-edited with a concrete value → must NOT be re-enqueued,
    // or the pending reset would clobber the user's new concrete value on the next pull.
    sinon.assert.neverCalledWith(markPendingResetStub, LS_KEY.organization);
  });

  // ── ADR-2: re-enqueue guard uses committedSinceReset, not isExplicitlyChanged ──

  test('ADR-2(b): sibling severity edit during window does NOT suppress re-enqueue for a different severity key', async () => {
    // Scenario: severity_filter_high is pending reset.
    // During the await gap the user edits severity_filter_low (a sibling sharing snyk.severity).
    // Under the old guard (isExplicitlyChanged) fan-out would mark severity_filter_high as
    // explicitly-changed → the reset would be wrongly suppressed.
    // Under ADR-2 (committedSinceReset), only severity_filter_low is marked in the windowed
    // signal → severity_filter_high is NOT committed-since-drain → reset IS re-enqueued.
    const markPendingResetStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      unmarkExplicitlyChanged: sinon.stub(),
      // OLD guard: fan-out marks both siblings → would suppress the reset (wrong)
      isExplicitlyChanged: (key: string) => key === LS_KEY.severityFilterHigh || key === LS_KEY.severityFilterLow,
      markPendingReset: markPendingResetStub,
      consumePendingResets: sinon.stub().returns(new Set<string>([LS_KEY.severityFilterHigh])),
      // NEW windowed signal: only severity_filter_low was committed by the user this window
      committedSinceReset: (key: string) => key === LS_KEY.severityFilterLow,
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
    };

    const fromConfigError = new Error('fromConfiguration failed — sibling fan-out test');
    sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
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

    await assert.rejects(
      async () => middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler),
      fromConfigError,
    );

    // severity_filter_high was NOT committed by the user in this window →
    // the reset MUST be re-enqueued (not suppressed by sibling fan-out).
    sinon.assert.calledWith(markPendingResetStub, LS_KEY.severityFilterHigh);
  });

  test('ADR-2(c): inbound write during window does NOT suppress re-enqueue', async () => {
    // Scenario: organization is pending reset.
    // During the window an inbound LS-originated write touches the setting (suppressed — marks
    // neither signal). fromConfiguration rejects → reset MUST be re-enqueued.
    const markPendingResetStub = sinon.stub();
    const tracker: IExplicitLspConfigurationChangeTracker = {
      markExplicitlyChanged: sinon.stub(),
      unmarkExplicitlyChanged: sinon.stub(),
      // Even if isExplicitlyChanged returned true due to an inbound write gap,
      // committedSinceReset is false (suppressor blocked the write).
      isExplicitlyChanged: () => true, // old guard would suppress — wrong
      markPendingReset: markPendingResetStub,
      consumePendingResets: sinon.stub().returns(new Set<string>([LS_KEY.organization])),
      committedSinceReset: () => false, // correct: inbound write marked neither signal
      markCommittedSinceReset: sinon.stub(),
      hasLastKnownValue: () => false,
      getLastKnownValue: () => undefined,
      setLastKnownValue: sinon.stub(),
    };

    const fromConfigError = new Error('fromConfiguration failed — inbound write test');
    sinon.stub(LanguageServerSettings, 'fromConfiguration').rejects(fromConfigError);

    const middleware = new LanguageClientMiddleware(
      new LoggerMockFailOnErrors(),
      configuration,
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

    await assert.rejects(
      async () => middleware.workspace.configuration({ items: [{ section: 'snyk' }] }, token, handler),
      fromConfigError,
    );

    // Organization was not committed by the user (inbound write, suppressed) →
    // the reset MUST be re-enqueued.
    sinon.assert.calledWith(markPendingResetStub, LS_KEY.organization);
  });
});
