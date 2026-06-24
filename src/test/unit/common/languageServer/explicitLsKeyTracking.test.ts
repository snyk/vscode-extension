import assert from 'assert';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import { seedExplicitChangesFromExistingSettings } from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal in-memory tracker that fulfils the interface. */
class FakeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();
  private readonly pending = new Set<string>();

  markExplicitlyChanged(lsKey: string): void {
    this.keys.add(lsKey);
  }

  unmarkExplicitlyChanged(lsKey: string): void {
    this.keys.delete(lsKey);
  }

  isExplicitlyChanged(lsKey: string): boolean {
    return this.keys.has(lsKey);
  }

  markPendingReset(lsKey: string): void {
    this.pending.add(lsKey);
  }

  consumePendingResets(): Set<string> {
    const snap = new Set(this.pending);
    this.pending.clear();
    return snap;
  }

  allKeys(): Set<string> {
    return new Set(this.keys);
  }
}

type InspectResult = { globalValue?: unknown; defaultValue?: unknown };

/** Builds a fake IVSCodeWorkspace whose inspectConfiguration is driven by a lookup map. */
function fakeWorkspace(
  map: Record<string, Record<string, InspectResult | undefined>>,
): Pick<IVSCodeWorkspace, 'inspectConfiguration'> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inspectConfiguration(configId: string, section: string): any {
      return map[configId]?.[section];
    },
  };
}

/** A minimal IConfiguration stub sufficient for the seeding function (strategy a — resolve is not called). */
const minimalConfig: IConfiguration = {
  shouldReportErrors: false,
  snykApiEndpoint: 'https://api.snyk.io/api',
  organization: 'test-org',
  // eslint-disable-next-line @typescript-eslint/require-await
  getToken: async () => '',
  getFeaturesConfiguration: () => ({
    ossEnabled: true,
    codeSecurityEnabled: true,
    iacEnabled: true,
    secretsEnabled: true,
  }),
  getCliPath: () => '/path/to/cli',
  getCliBaseDownloadUrl: () => 'https://downloads.snyk.io',
  getAdditionalCliParameters: () => '',
  getTrustedFolders: () => [],
  getInsecure: () => false,
  getDeltaFindingsEnabled: () => false,
  isAutomaticDependencyManagementEnabled: () => true,
  getFolderConfigs: () => [] as FolderConfig[],
  getOssQuickFixCodeActionsEnabled: () => true,
  getAuthenticationMethod: () => 'oauth',
  severityFilter: DEFAULT_SEVERITY_FILTER,
  riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
  issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
  scanningMode: 'auto',
  getSecureAtInceptionExecutionFrequency: () => 'Manual',
  getAutoConfigureMcpServer: () => false,
} as unknown as IConfiguration;

// ── Suite ─────────────────────────────────────────────────────────────────────

suite('seedExplicitChangesFromExistingSettings', () => {
  // T1: global value differs from default → LS key seeded
  test('T1: seeds LS key when global value differs from default', () => {
    const tracker = new FakeTracker();
    // organization: ADVANCED_ORGANIZATION = 'snyk.advanced.organization'
    // → configId: 'snyk', section: 'advanced.organization'
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: 'acme-corp', defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      'organization LS key should be seeded when globalValue differs from default',
    );
  });

  // T2: global value equals default → NOT seeded
  test('T2: does not seed when global value equals default', () => {
    const tracker = new FakeTracker();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: '', defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      'organization LS key should NOT be seeded when globalValue equals default',
    );
  });

  // T3: globalValue undefined → NOT seeded
  test('T3: does not seed when globalValue is undefined', () => {
    const tracker = new FakeTracker();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: undefined, defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      'organization LS key should NOT be seeded when globalValue is undefined',
    );
  });

  // T4: alwaysChanged entry → never seeded regardless of inspected value
  test('T4: never seeds alwaysChanged entries', () => {
    const tracker = new FakeTracker();
    // Even if inspect would match, alwaysChanged keys must be skipped.
    // trustEnabled, automaticAuthentication, hoverVerbosity, trustedFolders are alwaysChanged.
    const ws = fakeWorkspace({
      snyk: {
        // trustedFolders has alwaysChanged AND vscodeKey — provide a differing value to make clear
        // the alwaysChanged guard fires first.
        trustedFolders: { globalValue: ['/my/folder'], defaultValue: [] },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.trustedFolders),
      'trustedFolders (alwaysChanged) should never be seeded',
    );
    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.trustEnabled),
      'trustEnabled (alwaysChanged) should never be seeded',
    );
    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.automaticAuthentication),
      'automaticAuthentication (alwaysChanged) should never be seeded',
    );
    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.hoverVerbosity),
      'hoverVerbosity (alwaysChanged) should never be seeded',
    );
  });

  // T5: entry without vscodeKey → skipped
  test('T5: skips entries without vscodeKey (LS-only settings)', () => {
    const tracker = new FakeTracker();
    // token, sendErrorReports, enableSnykOssQuickFixActions have no vscodeKey.
    // Provide an empty workspace — if the seed incorrectly tries to inspect them it may throw or mark.
    const ws = fakeWorkspace({});

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(!tracker.isExplicitlyChanged(LS_GLOBAL_KEY.token), 'token (no vscodeKey) should never be seeded');
    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.sendErrorReports),
      'sendErrorReports (no vscodeKey) should never be seeded',
    );
    assert.ok(
      !tracker.isExplicitlyChanged(LS_GLOBAL_KEY.enableSnykOssQuickFixActions),
      'enableSnykOssQuickFixActions (no vscodeKey) should never be seeded',
    );
  });

  // T6: key already in tracker → idempotent; inspect not re-evaluated
  test('T6: is idempotent — does not re-evaluate keys already in tracker', () => {
    const tracker = new FakeTracker();
    // Pre-seed organization
    tracker.markExplicitlyChanged(LS_GLOBAL_KEY.organization);

    let inspectCallCount = 0;
    const ws: Pick<IVSCodeWorkspace, 'inspectConfiguration'> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inspectConfiguration(configId: string, section: string): any {
        if (configId === 'snyk' && section === 'advanced.organization') {
          inspectCallCount++;
        }
        return undefined;
      },
    };

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.strictEqual(
      inspectCallCount,
      0,
      'inspectConfiguration should not be called for keys already in the tracker',
    );
    assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization), 'organization should still be in tracker');
  });

  // T7: shared vscodeKey (severity filter object customised) → all 4 severity LS keys seeded
  test('T7: seeds all severity LS keys when the shared severity vscodeKey object differs from default', () => {
    const tracker = new FakeTracker();
    // SEVERITY_FILTER_SETTING = 'snyk.severity' → configId: 'snyk', section: 'severity'
    // User customised — object differs from default.
    const ws = fakeWorkspace({
      snyk: {
        severity: {
          globalValue: { critical: true, high: true, medium: false, low: false },
          defaultValue: { critical: true, high: true, medium: true, low: true },
        },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical), 'severityFilterCritical seeded');
    assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh), 'severityFilterHigh seeded');
    assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium), 'severityFilterMedium seeded');
    assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow), 'severityFilterLow seeded');
  });

  // T_F2: defaultValue undefined but globalValue defined → IS seeded (defined globalValue is itself a deviation)
  test('T_F2: seeds when defaultValue is undefined but the user set a global value', () => {
    const tracker = new FakeTracker();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: 'custom-value', defaultValue: undefined },
      },
    });

    seedExplicitChangesFromExistingSettings(tracker, ws);

    assert.ok(
      tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization),
      'organization LS key should be seeded when defaultValue is undefined but globalValue is defined',
    );
  });

  // T8: inspectConfiguration returns undefined → skip without throwing
  test('T8: does not throw when inspectConfiguration returns undefined', () => {
    const tracker = new FakeTracker();
    // All inspections return undefined
    const ws = fakeWorkspace({});

    assert.doesNotThrow(() => {
      seedExplicitChangesFromExistingSettings(tracker, ws);
    }, 'seedExplicitChangesFromExistingSettings must not throw when inspect returns undefined');
  });

  // ── Integration-style suite (CP2) ─────────────────────────────────────────

  suite('integration: seeded org produces changed:true via LanguageServerSettings.fromConfiguration', () => {
    // T9: seeded org/endpoint → changed:true; untouched setting → changed:false
    test('T9: seeded org produces changed:true; untouched api endpoint produces changed:false', async () => {
      const tracker = new FakeTracker();

      // Build a config with a custom org and default-like endpoint.
      const config: IConfiguration = {
        ...minimalConfig,
        organization: 'my-company',
        snykApiEndpoint: 'https://api.snyk.io/api',
      } as unknown as IConfiguration;

      // Workspace reports org as customised, endpoint as default (undefined globalValue).
      const ws = fakeWorkspace({
        snyk: {
          'advanced.organization': { globalValue: 'my-company', defaultValue: '' },
          'advanced.customEndpoint': { globalValue: undefined, defaultValue: '' },
        },
      });

      seedExplicitChangesFromExistingSettings(tracker, ws);

      const lsParams = await LanguageServerSettings.fromConfiguration(config, lsKey =>
        tracker.isExplicitlyChanged(lsKey),
      );

      assert.strictEqual(
        lsParams.settings?.[LS_GLOBAL_KEY.organization]?.changed,
        true,
        'organization should be changed:true after seeding',
      );
      assert.strictEqual(
        lsParams.settings?.[LS_GLOBAL_KEY.apiEndpoint]?.changed,
        false,
        'apiEndpoint should be changed:false when not seeded',
      );
    });

    // T10: no-default setting (defaultValue undefined) with user global value → changed:true via fromConfiguration
    test('T10: no-default setting with user global value produces changed:true via fromConfiguration', async () => {
      const tracker = new FakeTracker();

      // organization has no package.json default (defaultValue: undefined); user set a global value.
      const config: IConfiguration = {
        ...minimalConfig,
        organization: 'no-default-org',
        snykApiEndpoint: 'https://api.snyk.io/api',
      } as unknown as IConfiguration;

      const ws = fakeWorkspace({
        snyk: {
          'advanced.organization': { globalValue: 'no-default-org', defaultValue: undefined },
        },
      });

      seedExplicitChangesFromExistingSettings(tracker, ws);

      const lsParams = await LanguageServerSettings.fromConfiguration(config, lsKey =>
        tracker.isExplicitlyChanged(lsKey),
      );

      assert.strictEqual(
        lsParams.settings?.[LS_GLOBAL_KEY.organization]?.changed,
        true,
        'organization should be changed:true when defaultValue is undefined but user set a global value',
      );
    });
  });
});
