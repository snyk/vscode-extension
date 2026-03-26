// ABOUTME: Unit tests for inbound LS explicit-override filtering
import sinon from 'sinon';
import assert from 'assert';
import { filterInboundPartialByExplicitOverrides } from '../../../../snyk/common/languageServer/inboundLspExplicitOverrideFilter';
import { PFLAG } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import type { IConfiguration } from '../../../../snyk/common/configuration/configuration';

suite('inboundLspExplicitOverrideFilter', () => {
  let tracker: IExplicitLspConfigurationChangeTracker;
  let configuration: IConfiguration;

  setup(() => {
    tracker = {
      markExplicitlyChanged: sinon.stub(),
      isExplicitlyChanged: sinon.stub().returns(false),
    };
    configuration = {
      getFeaturesConfiguration: sinon.stub().returns({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      }),
      scanningMode: 'auto',
      organization: 'org-a',
      snykApiEndpoint: 'https://api.snyk.io',
      getInsecure: sinon.stub().returns(false),
      getAuthenticationMethod: sinon.stub().returns('oauth'),
      getDeltaFindingsEnabled: sinon.stub().returns(false),
      severityFilter: {},
      issueViewOptions: { openIssues: true, ignoredIssues: false },
      riskScoreThreshold: 0,
      getTrustedFolders: sinon.stub().returns([]),
      getCliPath: sinon.stub().resolves('/cli'),
      isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
      getCliBaseDownloadUrl: sinon.stub().returns(''),
      getToken: sinon.stub().resolves('tok-a'),
    } as unknown as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('drops conflicting endpoint when api_endpoint is explicit', async () => {
    (tracker.isExplicitlyChanged as sinon.SinonStub).callsFake((k: string) => k === PFLAG.apiEndpoint);

    const { filtered, reconcileNeeded } = await filterInboundPartialByExplicitOverrides(
      { endpoint: 'https://other.example' },
      tracker,
      configuration,
    );

    assert.deepStrictEqual(filtered, {});
    assert.strictEqual(reconcileNeeded, true);
  });

  test('keeps inbound value when explicit and matching IDE', async () => {
    (tracker.isExplicitlyChanged as sinon.SinonStub).callsFake((k: string) => k === PFLAG.apiEndpoint);

    const { filtered, reconcileNeeded } = await filterInboundPartialByExplicitOverrides(
      { endpoint: 'https://api.snyk.io' },
      tracker,
      configuration,
    );

    assert.deepStrictEqual(filtered, { endpoint: 'https://api.snyk.io' });
    assert.strictEqual(reconcileNeeded, false);
  });

  test('passes through when not explicit', async () => {
    const { filtered, reconcileNeeded } = await filterInboundPartialByExplicitOverrides(
      { endpoint: 'https://ls-only.example' },
      tracker,
      configuration,
    );

    assert.deepStrictEqual(filtered, { endpoint: 'https://ls-only.example' });
    assert.strictEqual(reconcileNeeded, false);
  });
});
