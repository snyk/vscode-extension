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
  vscodeValueMatchesLastKnown,
} from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { ExplicitOverridesMap } from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import { SETTINGS_REGISTRY } from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
import { SEVERITY_FILTER_SETTING, ADVANCED_ORGANIZATION } from '../../../../snyk/common/constants/settings';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

/** Minimal in-memory Memento, sufficient for ExplicitOverridesMap's constructor read. */
function makeMemento(): import('vscode').Memento {
  const store = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue?: T): T {
      return (store.has(key) ? store.get(key) : defaultValue) as T;
    },
    update(key: string, value: unknown): Thenable<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    keys(): readonly string[] {
      return [...store.keys()];
    },
  };
}

/** Fake workspace whose getConfiguration is driven by a `${configId}.${section}` lookup map. */
function fakeGetConfigWorkspace(map: Record<string, unknown>): Pick<IVSCodeWorkspace, 'getConfiguration'> {
  return {
    getConfiguration: (configId: string, section: string) => map[`${configId}.${section}`],
  } as Pick<IVSCodeWorkspace, 'getConfiguration'>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal in-memory tracker that fulfils the interface. */
class FakeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly committed = new Set<string>();
  private readonly lastKnown = new Map<string, unknown>();
  private readonly pendingInboundWrites = new Set<string>();

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

  markPendingInboundWrite(vscodeKey: string): void {
    this.pendingInboundWrites.add(vscodeKey);
  }

  consumePendingInboundWrite(vscodeKey: string): boolean {
    return this.pendingInboundWrites.delete(vscodeKey);
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

  // ── markExplicitLsKeysFromConfigurationChangeEvent [IDE-2264 ticket 04] ────────────────────
  // Direct settings.json-edit detection: compares each affected VS Code key's current raw
  // value against the shared last-known-value cache (ticket 01) instead of a write-time
  // pending tag, and folds fan-out sibling disambiguation into the very same cache.

  suite('markExplicitLsKeysFromConfigurationChangeEvent (direct-edit detection)', () => {
    /** Fake ConfigurationChangeEvent that reports all keys as affected. */
    function fakeEvent(affectedVscodeKeys: string[]): { affectsConfiguration(key: string): boolean } {
      return {
        affectsConfiguration(key: string): boolean {
          return affectedVscodeKeys.includes(key);
        },
      };
    }

    function newOverridesMap(): ExplicitOverridesMap {
      return new ExplicitOverridesMap(makeMemento());
    }

    test('fan-out: only the sibling whose projected sub-value changed is marked explicit', async () => {
      const overrides = newOverridesMap();
      // Cache seeded with the previous raw severity object.
      const cache = new LastKnownValueCache(
        fakeGetConfigWorkspace({ 'snyk.severity': { critical: true, high: true, medium: true, low: true } }),
        [SEVERITY_FILTER_SETTING],
      );
      // The current raw value has only 'medium' changed.
      const newWorkspace = fakeGetConfigWorkspace({
        'snyk.severity': { critical: true, high: true, medium: false, low: true },
      });

      const e = fakeEvent([SEVERITY_FILTER_SETTING]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig);

      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
        kind: 'value',
        value: false,
      });
      assert.strictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterCritical), undefined, 'critical: unchanged');
      assert.strictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterHigh), undefined, 'high: unchanged');
      assert.strictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterLow), undefined, 'low: unchanged');
    });

    test('fan-out: a never-before-seeded cache still marks only the sibling that genuinely differs from default', async () => {
      const overrides = newOverridesMap();
      // Cache never seeded for the severity key (e.g. it was never customised before activation).
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({}), []);
      // User writes an explicit object where only 'medium' differs from the schema default.
      const newWorkspace = fakeGetConfigWorkspace({
        'snyk.severity': { critical: true, high: true, medium: false, low: true },
      });

      const e = fakeEvent([SEVERITY_FILTER_SETTING]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig);

      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
        kind: 'value',
        value: false,
      });
      assert.strictEqual(
        overrides.getEntry(LS_GLOBAL_KEY.severityFilterCritical),
        undefined,
        'critical: matches default (true), not marked despite the cold cache',
      );
    });

    test('fan-out: whole-object match against the cache skips all siblings (no divergence at all)', async () => {
      const overrides = newOverridesMap();
      const raw = { critical: true, high: true, medium: true, low: true };
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.severity': raw }), [
        SEVERITY_FILTER_SETTING,
      ]);
      const newWorkspace = fakeGetConfigWorkspace({ 'snyk.severity': raw });

      const e = fakeEvent([SEVERITY_FILTER_SETTING]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig);

      for (const lsKey of [
        LS_GLOBAL_KEY.severityFilterCritical,
        LS_GLOBAL_KEY.severityFilterHigh,
        LS_GLOBAL_KEY.severityFilterMedium,
        LS_GLOBAL_KEY.severityFilterLow,
      ]) {
        assert.strictEqual(overrides.getEntry(lsKey), undefined, `${lsKey}: not marked — raw value unchanged`);
      }
    });

    test('single-LS-key setting: a genuinely different value is marked explicit with the resolved LS value', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'old-org' }), [
        ADVANCED_ORGANIZATION,
      ]);
      const newWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'new-org' });
      const configuration: IConfiguration = { ...minimalConfig, organization: 'new-org' } as unknown as IConfiguration;

      const e = fakeEvent([ADVANCED_ORGANIZATION]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, configuration);

      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.organization), { kind: 'value', value: 'new-org' });
      assert.strictEqual(cache.get(ADVANCED_ORGANIZATION), 'new-org', 'cache updated to the new raw value');
    });

    test('a change event whose value matches the cache is not marked explicit (own echoed write)', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'my-org' }), [
        ADVANCED_ORGANIZATION,
      ]);
      // The event fired (e.g. a delayed echo of the extension's own write), but the current
      // value already matches what the cache holds.
      const newWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'my-org' });

      const e = fakeEvent([ADVANCED_ORGANIZATION]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig);

      assert.strictEqual(overrides.getEntry(LS_GLOBAL_KEY.organization), undefined);
    });

    test('cold-start: a key seeded from existing VS Code configuration at construction is not a false positive on the first event', async () => {
      const overrides = newOverridesMap();
      // Cache constructed at "activation" from a workspace that already has a customised value.
      const activationWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'acme-corp' });
      const cache = new LastKnownValueCache(activationWorkspace, [ADVANCED_ORGANIZATION]);

      // First onDidChangeConfiguration event after activation for this key fires, but nothing
      // has actually changed since the cache was seeded.
      const e = fakeEvent([ADVANCED_ORGANIZATION]);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, activationWorkspace, minimalConfig);

      assert.strictEqual(
        overrides.getEntry(LS_GLOBAL_KEY.organization),
        undefined,
        'a pre-existing, already-seeded customisation must not be treated as a fresh explicit edit',
      );
    });

    test('resolver throw for one fan-out sibling does not prevent the remaining siblings from being marked', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(
        fakeGetConfigWorkspace({ 'snyk.severity': { critical: true, high: true, medium: true, low: true } }),
        [SEVERITY_FILTER_SETTING],
      );
      const newWorkspace = fakeGetConfigWorkspace({
        'snyk.severity': { critical: true, high: true, medium: false, low: true },
      });

      const originalResolve = SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve;
      SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve = () => {
        throw new Error('resolver boom');
      };

      try {
        const e = fakeEvent([SEVERITY_FILTER_SETTING]);
        await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig);

        assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
          kind: 'value',
          value: false,
        });
        assert.strictEqual(
          overrides.getEntry(LS_GLOBAL_KEY.severityFilterCritical),
          undefined,
          'critical: throwing resolver is treated as value-unknown on both sides, so no (false) change is detected',
        );
      } finally {
        SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve = originalResolve;
      }
    });

    test('single-key: an async resolver (e.g. cliPath) is awaited, not discarded', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.cliPath': '/old/cli' }), [
        'snyk.advanced.cliPath',
      ]);
      const newWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.cliPath': '/new/cli' });
      const configuration: IConfiguration = {
        ...minimalConfig,
        getCliPath: () => Promise.resolve('/new/cli'),
      } as unknown as IConfiguration;

      const e = fakeEvent(['snyk.advanced.cliPath']);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, configuration);

      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.cliPath), { kind: 'value', value: '/new/cli' });
    });

    test('single-key: a rejected async resolver is treated as value-unknown, not left uncaught', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.cliPath': '/old/cli' }), [
        'snyk.advanced.cliPath',
      ]);
      const newWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.cliPath': '/new/cli' });
      const configuration: IConfiguration = {
        ...minimalConfig,
        getCliPath: () => Promise.reject(new Error('cliPath resolution boom')),
      } as unknown as IConfiguration;

      const e = fakeEvent(['snyk.advanced.cliPath']);
      await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, configuration);

      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.cliPath), { kind: 'value', value: undefined });
    });
  });

  suite('vscodeValueMatchesLastKnown', () => {
    test('returns true when the current value equals the cache entry', () => {
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'my-org' }), [
        ADVANCED_ORGANIZATION,
      ]);
      const workspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'my-org' });

      assert.strictEqual(vscodeValueMatchesLastKnown(ADVANCED_ORGANIZATION, workspace, cache), true);
    });

    test('returns false when the current value diverges from the cache entry', () => {
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'my-org' }), [
        ADVANCED_ORGANIZATION,
      ]);
      const workspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'new-org' });

      assert.strictEqual(vscodeValueMatchesLastKnown(ADVANCED_ORGANIZATION, workspace, cache), false);
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
