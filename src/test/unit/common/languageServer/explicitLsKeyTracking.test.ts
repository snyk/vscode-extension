import assert from 'assert';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import {
  hasUnreflectedConfigurationChange,
  markExplicitLsKeysFromConfigurationChangeEvent,
  seedExplicitChangesFromExistingSettings,
  vscodeValueMatchesLastKnown,
} from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { ExplicitOverridesMap } from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import { SETTINGS_REGISTRY, VSCODE_KEY_TO_LS_KEYS } from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
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

function newOverridesMap(): ExplicitOverridesMap {
  return new ExplicitOverridesMap(makeMemento());
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    const overrides = newOverridesMap();
    // organization: ADVANCED_ORGANIZATION = 'snyk.advanced.organization'
    // → configId: 'snyk', section: 'advanced.organization'
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: 'acme-corp', defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.organization) !== undefined,
      'organization LS key should be seeded when globalValue differs from default',
    );
  });

  // T2: global value equals default → NOT seeded
  test('T2: does not seed when global value equals default', () => {
    const overrides = newOverridesMap();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: '', defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.organization) === undefined,
      'organization LS key should NOT be seeded when globalValue equals default',
    );
  });

  // T3: globalValue undefined → NOT seeded
  test('T3: does not seed when globalValue is undefined', () => {
    const overrides = newOverridesMap();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: undefined, defaultValue: '' },
      },
    });

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.organization) === undefined,
      'organization LS key should NOT be seeded when globalValue is undefined',
    );
  });

  // T4: alwaysChanged entry → never seeded regardless of inspected value
  test('T4: never seeds alwaysChanged entries', () => {
    const overrides = newOverridesMap();
    // Even if inspect would match, alwaysChanged keys must be skipped.
    // trustEnabled, automaticAuthentication, hoverVerbosity, trustedFolders are alwaysChanged.
    const ws = fakeWorkspace({
      snyk: {
        // trustedFolders has alwaysChanged AND vscodeKey — provide a differing value to make clear
        // the alwaysChanged guard fires first.
        trustedFolders: { globalValue: ['/my/folder'], defaultValue: [] },
      },
    });

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.trustedFolders) === undefined,
      'trustedFolders (alwaysChanged) should never be seeded',
    );
    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.trustEnabled) === undefined,
      'trustEnabled (alwaysChanged) should never be seeded',
    );
    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.automaticAuthentication) === undefined,
      'automaticAuthentication (alwaysChanged) should never be seeded',
    );
    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.hoverVerbosity) === undefined,
      'hoverVerbosity (alwaysChanged) should never be seeded',
    );
  });

  // T5: entry without vscodeKey → skipped
  test('T5: skips entries without vscodeKey (LS-only settings)', () => {
    const overrides = newOverridesMap();
    // token, sendErrorReports, enableSnykOssQuickFixActions have no vscodeKey.
    // Provide an empty workspace — if the seed incorrectly tries to inspect them it may throw or mark.
    const ws = fakeWorkspace({});

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.token) === undefined, 'token (no vscodeKey) should never be seeded');
    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.sendErrorReports) === undefined,
      'sendErrorReports (no vscodeKey) should never be seeded',
    );
    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.enableSnykOssQuickFixActions) === undefined,
      'enableSnykOssQuickFixActions (no vscodeKey) should never be seeded',
    );
  });

  // T6: key already in the map → idempotent; inspect not re-evaluated
  test('T6: is idempotent — does not re-evaluate keys already in the map', () => {
    const overrides = newOverridesMap();
    // Pre-seed organization
    overrides.setExplicitValue(LS_GLOBAL_KEY.organization, 'acme-corp');

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

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.strictEqual(inspectCallCount, 0, 'inspectConfiguration should not be called for keys already in the map');
    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.organization) !== undefined, 'organization should still be in the map');
  });

  // T7: shared vscodeKey (severity filter object customised) → all 4 severity LS keys seeded
  test('T7: seeds all severity LS keys when the shared severity vscodeKey object differs from default', () => {
    const overrides = newOverridesMap();
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

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.severityFilterCritical) !== undefined, 'severityFilterCritical seeded');
    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.severityFilterHigh) !== undefined, 'severityFilterHigh seeded');
    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.severityFilterMedium) !== undefined, 'severityFilterMedium seeded');
    assert.ok(overrides.getEntry(LS_GLOBAL_KEY.severityFilterLow) !== undefined, 'severityFilterLow seeded');
  });

  // T_F2: defaultValue undefined but globalValue defined → IS seeded (defined globalValue is itself a deviation)
  test('T_F2: seeds when defaultValue is undefined but the user set a global value', () => {
    const overrides = newOverridesMap();
    const ws = fakeWorkspace({
      snyk: {
        'advanced.organization': { globalValue: 'custom-value', defaultValue: undefined },
      },
    });

    seedExplicitChangesFromExistingSettings(overrides, ws);

    assert.ok(
      overrides.getEntry(LS_GLOBAL_KEY.organization) !== undefined,
      'organization LS key should be seeded when defaultValue is undefined but globalValue is defined',
    );
  });

  // T8: inspectConfiguration returns undefined → skip without throwing
  test('T8: does not throw when inspectConfiguration returns undefined', () => {
    const overrides = newOverridesMap();
    // All inspections return undefined
    const ws = fakeWorkspace({});

    assert.doesNotThrow(() => {
      seedExplicitChangesFromExistingSettings(overrides, ws);
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

    test('resolver throw for one fan-out sibling does not prevent the remaining siblings from being marked, and is logged', async () => {
      const overrides = newOverridesMap();
      const cache = new LastKnownValueCache(
        fakeGetConfigWorkspace({ 'snyk.severity': { critical: true, high: true, medium: true, low: true } }),
        [SEVERITY_FILTER_SETTING],
      );
      const newWorkspace = fakeGetConfigWorkspace({
        'snyk.severity': { critical: true, high: true, medium: false, low: true },
      });
      const errors: unknown[] = [];
      const logger = { error: (message: unknown) => errors.push(message) };

      const originalResolve = SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve;
      SETTINGS_REGISTRY[LS_GLOBAL_KEY.severityFilterCritical].resolve = () => {
        throw new Error('resolver boom');
      };

      try {
        const e = fakeEvent([SEVERITY_FILTER_SETTING]);
        await markExplicitLsKeysFromConfigurationChangeEvent(e, overrides, cache, newWorkspace, minimalConfig, logger);

        assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.severityFilterMedium), {
          kind: 'value',
          value: false,
        });
        assert.strictEqual(
          overrides.getEntry(LS_GLOBAL_KEY.severityFilterCritical),
          undefined,
          'critical: throwing resolver is treated as value-unknown on both sides, so no (false) change is detected',
        );
        assert.strictEqual(errors.length > 0, true, 'a resolver throw must be logged, not silently swallowed');
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

  // ── hasUnreflectedConfigurationChange [IDE-2264 ticket 05] ─────────────────────
  // The middleware's independent echo-suppression decision: reuses the same
  // vscodeValueMatchesLastKnown primitive across every tracked VS Code key.

  suite('hasUnreflectedConfigurationChange', () => {
    test('returns false when every tracked key currently matches the last-known-value cache', () => {
      const workspace = fakeGetConfigWorkspace({});
      const cache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

      assert.strictEqual(
        hasUnreflectedConfigurationChange(workspace, cache),
        false,
        'a purely-echoed event (nothing diverges from the cache) must not report an unreflected change',
      );
    });

    test('returns true when a single tracked key currently diverges from the last-known-value cache', () => {
      const activationWorkspace = fakeGetConfigWorkspace({});
      const cache = new LastKnownValueCache(activationWorkspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));
      const currentWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'new-org' });

      assert.strictEqual(
        hasUnreflectedConfigurationChange(currentWorkspace, cache),
        true,
        'a genuine external edit to even one tracked key must be reported as an unreflected change',
      );
    });

    test('is immune to a batch-scoped timing gap: still reports "no change" for a delayed event once the cache already reflects the write', () => {
      // Simulates ticket 05's target scenario: an inbound-write batch already updated the
      // last-known-value cache for the LAST key in the batch (at write time), well before this
      // configuration-change event actually fires. There is no flag to have expired — the cache
      // is simply already up to date, regardless of how late the event arrives.
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({}), Object.keys(VSCODE_KEY_TO_LS_KEYS));
      cache.set(ADVANCED_ORGANIZATION, 'inbound-value');
      const delayedWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'inbound-value' });

      assert.strictEqual(hasUnreflectedConfigurationChange(delayedWorkspace, cache), false);
    });

    test('agrees with markExplicitLsKeysFromConfigurationChangeEvent for the same event regardless of which runs first', async () => {
      // Simulates VS Code invoking the explicit-marking listener FIRST for this event, with the
      // middleware's independent check running synchronously right after (before the marking
      // listener's own promise has been awaited to completion) — the adversarial ordering ticket
      // 05 must be immune to.
      const overrides = new ExplicitOverridesMap(makeMemento());
      const cache = new LastKnownValueCache(fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'old-org' }), [
        ADVANCED_ORGANIZATION,
      ]);
      const currentWorkspace = fakeGetConfigWorkspace({ 'snyk.advanced.organization': 'new-org' });
      const configuration: IConfiguration = { ...minimalConfig, organization: 'new-org' } as unknown as IConfiguration;
      const e = { affectsConfiguration: (key: string) => key === ADVANCED_ORGANIZATION };

      const markingDone = markExplicitLsKeysFromConfigurationChangeEvent(
        e,
        overrides,
        cache,
        currentWorkspace,
        configuration,
      );
      // Still within the same synchronous dispatch as the line above — the marking listener's
      // cache mutation (if any) has not yet had a chance to run.
      const shouldForward = hasUnreflectedConfigurationChange(currentWorkspace, cache);
      await markingDone;

      assert.strictEqual(
        shouldForward,
        true,
        'the middleware must detect the genuine external edit even though the marking listener ran first',
      );
      assert.deepStrictEqual(overrides.getEntry(LS_GLOBAL_KEY.organization), { kind: 'value', value: 'new-org' });
    });
  });

  suite('integration: seeded org produces changed:true via LanguageServerSettings.fromConfiguration', () => {
    // T9: seeded org/endpoint → changed:true; untouched setting → changed:false
    test('T9: seeded org produces changed:true; untouched api endpoint produces changed:false', async () => {
      const overrides = newOverridesMap();

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

      seedExplicitChangesFromExistingSettings(overrides, ws);

      const lsParams = await LanguageServerSettings.fromConfiguration(
        config,
        lsKey => overrides.getEntry(lsKey) !== undefined,
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
      const overrides = newOverridesMap();

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

      seedExplicitChangesFromExistingSettings(overrides, ws);

      const lsParams = await LanguageServerSettings.fromConfiguration(
        config,
        lsKey => overrides.getEntry(lsKey) !== undefined,
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
// D1b (warm-cache fan-out guard) is now subsumed by two stronger tests:
//   - 'ConfigurationPersistenceService — D1: setLastKnownValue seeded after outbound reset'
//     in configurationPersistenceService.test.ts (goes RED when the seeding call is deleted)
//   - 'D1-fanout-severity' in the same file (real handleSaveConfig + real fan-out, goes RED if
//     D1 seeding is skipped for fan-out keys)
// [IDE-2264 ticket 09]: ExplicitLspConfigurationChangeTracker and its dedicated test file were
// deleted — the explicit-overrides map is now the sole source for `changed`; this file's own
// fan-out tests above are the only coverage for that concern.
