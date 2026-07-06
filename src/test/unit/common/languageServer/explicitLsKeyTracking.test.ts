import assert from 'assert';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { IExplicitLspConfigurationChangeTracker } from '../../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';
import {
  markExplicitLsKeysFromConfigurationChangeEvent,
  seedExplicitChangesFromExistingSettings,
} from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal in-memory tracker that fulfils the interface. */
class FakeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly committed = new Set<string>();
  private readonly lastKnown = new Map<string, unknown>();

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
    this.committed.delete(lsKey);
  }

  consumePendingResets(): Set<string> {
    const snap = new Set(this.pending);
    this.pending.clear();
    return snap;
  }

  markCommittedSinceReset(lsKey: string): void {
    this.committed.add(lsKey);
  }
  committedSinceReset(lsKey: string): boolean {
    return this.committed.has(lsKey);
  }
  hasLastKnownValue(lsKey: string): boolean {
    return this.lastKnown.has(lsKey);
  }
  getLastKnownValue(lsKey: string): unknown {
    return this.lastKnown.get(lsKey);
  }
  setLastKnownValue(lsKey: string, value: unknown): void {
    this.lastKnown.set(lsKey, value);
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
  getAdditionalCliEnvironment: () => '',
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

  suite('markExplicitLsKeysFromConfigurationChangeEvent (ADR-2 windowed signal)', () => {
    /** Fake ConfigurationChangeEvent that reports all keys as affected. */
    function fakeEvent(affectedVscodeKeys: string[]): { affectsConfiguration(key: string): boolean } {
      return {
        affectsConfiguration(key: string): boolean {
          return affectedVscodeKeys.includes(key);
        },
      };
    }

    // Import the severity vscodeKey from the registry so the test does not hard-code the string.
    // The severity fan-out group shares one VS Code key: 'snyk.severity'.
    const SEVERITY_VSCODE_KEY = 'snyk.severity';

    test('fan-out: only the sibling whose value changed is marked in committedSinceReset', () => {
      const tracker = new FakeTracker();

      // Pre-populate lastKnownValues: high=true, low=true (cached from previous call).
      tracker.setLastKnownValue(LS_GLOBAL_KEY.severityFilterHigh, true);
      tracker.setLastKnownValue(LS_GLOBAL_KEY.severityFilterLow, true);
      tracker.setLastKnownValue(LS_GLOBAL_KEY.severityFilterMedium, true);
      tracker.setLastKnownValue(LS_GLOBAL_KEY.severityFilterCritical, true);

      // User edited: medium becomes false; the others stay the same.
      const currentValues: Record<string, unknown> = {
        [LS_GLOBAL_KEY.severityFilterCritical]: true,
        [LS_GLOBAL_KEY.severityFilterHigh]: true,
        [LS_GLOBAL_KEY.severityFilterMedium]: false, // changed!
        [LS_GLOBAL_KEY.severityFilterLow]: true,
      };

      const e = fakeEvent([SEVERITY_VSCODE_KEY]);
      markExplicitLsKeysFromConfigurationChangeEvent(e, tracker, lsKey => currentValues[lsKey]);

      // All siblings get the cumulative mark (isExplicitlyChanged).
      assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterCritical), 'critical: cumulative marked');
      assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterHigh), 'high: cumulative marked');
      assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterMedium), 'medium: cumulative marked');
      assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.severityFilterLow), 'low: cumulative marked');

      // Only the sibling that CHANGED gets the windowed signal.
      assert.ok(
        !tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterCritical),
        'critical: NOT committed (unchanged)',
      );
      assert.ok(!tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterHigh), 'high: NOT committed (unchanged)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterMedium), 'medium: committed (value changed)');
      assert.ok(!tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterLow), 'low: NOT committed (unchanged)');
    });

    test('fan-out: cold cache (no prior lastKnownValue) conservatively marks committedSinceReset', () => {
      const tracker = new FakeTracker();
      // No pre-seeded lastKnownValues — all return undefined.

      const currentValues: Record<string, unknown> = {
        [LS_GLOBAL_KEY.severityFilterCritical]: true,
        [LS_GLOBAL_KEY.severityFilterHigh]: true,
        [LS_GLOBAL_KEY.severityFilterMedium]: true,
        [LS_GLOBAL_KEY.severityFilterLow]: true,
      };

      const e = fakeEvent([SEVERITY_VSCODE_KEY]);
      markExplicitLsKeysFromConfigurationChangeEvent(e, tracker, lsKey => currentValues[lsKey]);

      // Cold cache (oldValue undefined) → all siblings conservatively marked.
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterCritical), 'critical: marked (cold cache)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterHigh), 'high: marked (cold cache)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterMedium), 'medium: marked (cold cache)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterLow), 'low: marked (cold cache)');
    });

    test('single-LS-key setting: always marks both signals regardless of value change', () => {
      const tracker = new FakeTracker();

      // organization maps to a single LS key.  Pre-seed lastKnownValue with the same value.
      tracker.setLastKnownValue(LS_GLOBAL_KEY.organization, 'my-org');

      const e = fakeEvent(['snyk.advanced.organization']);
      markExplicitLsKeysFromConfigurationChangeEvent(e, tracker, _lsKey => 'my-org');

      // VS Code only fires the event when value changed, so we always mark both signals.
      assert.ok(tracker.isExplicitlyChanged(LS_GLOBAL_KEY.organization), 'org: cumulative marked');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.organization), 'org: windowed signal marked');
    });

    test('without currentValueOf: all matching LS keys marked in both signals', () => {
      const tracker = new FakeTracker();

      const e = fakeEvent([SEVERITY_VSCODE_KEY]);
      // No currentValueOf → falls back to pre-ADR-2 behaviour (marks all).
      markExplicitLsKeysFromConfigurationChangeEvent(e, tracker);

      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterCritical), 'critical: marked (no resolver)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterHigh), 'high: marked (no resolver)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterMedium), 'medium: marked (no resolver)');
      assert.ok(tracker.committedSinceReset(LS_GLOBAL_KEY.severityFilterLow), 'low: marked (no resolver)');
    });

    test('lastKnownValues cache updated after call', () => {
      const tracker = new FakeTracker();

      const e = fakeEvent([SEVERITY_VSCODE_KEY]);
      const resolver = (lsKey: string): unknown => (lsKey === LS_GLOBAL_KEY.severityFilterMedium ? false : true);

      markExplicitLsKeysFromConfigurationChangeEvent(e, tracker, resolver);

      // The cache should now hold the new values from the resolver.
      assert.strictEqual(
        tracker.getLastKnownValue(LS_GLOBAL_KEY.severityFilterMedium),
        false,
        'medium cached as false',
      );
      assert.strictEqual(tracker.getLastKnownValue(LS_GLOBAL_KEY.severityFilterHigh), true, 'high cached as true');
    });
  });

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

// D1a and D1b were removed: their coverage is subsumed by stronger tests elsewhere.
// D1a was vacuous (only asserted typeof hasLastKnownValue === 'function').
// D1b (warm-cache fan-out guard with FakeTracker) is now subsumed by two stronger tests:
//   - 'ConfigurationPersistenceService — D1: setLastKnownValue seeded after outbound reset'
//     in configurationPersistenceService.test.ts (goes RED when the seeding call is deleted)
//   - 'D1-fanout-severity' in the same file (real tracker, real handleSaveConfig + real fan-out,
//     goes RED if D1 seeding is skipped for fan-out keys)
//   - 'D2' in explicitLspConfigurationChangeTracker.test.ts (real tracker, warm-cache-undefined
//     → not marked, uses the production guard directly)
