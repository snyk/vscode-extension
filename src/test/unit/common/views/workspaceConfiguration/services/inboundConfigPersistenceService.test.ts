// ABOUTME: Unit tests for InboundConfigPersistenceService
// ABOUTME: Tests the LS-push write path, which structurally has no access to the explicit-overrides map
import assert from 'assert';
import sinon from 'sinon';
import { InboundConfigPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/inboundConfigPersistenceService';
import { IConfiguration } from '../../../../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../../../../snyk/common/vscode/workspace';
import {
  IScopeDetectionService,
  ScopeDetectionService,
} from '../../../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import {
  ADVANCED_ORGANIZATION,
  CONFIGURATION_IDENTIFIER,
  DELTA_FINDINGS,
  SCANNING_MODE,
} from '../../../../../../snyk/common/constants/settings';
import { ALLISSUES, NEWISSUES } from '../../../../../../snyk/common/configuration/configuration';
import {
  LS_GLOBAL_KEY,
  LS_KEY,
} from '../../../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { LspConfigSetting, LspConfigurationParam } from '../../../../../../snyk/common/languageServer/types';
import { LanguageServerSettings } from '../../../../../../snyk/common/languageServer/settings';
import {
  ExplicitOverridesMap,
  IExplicitOverridesMap,
} from '../../../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../../../snyk/common/languageServer/lastKnownValueCache';
import { noopLastKnownValueCache } from '../../../../mocks/explicitOverridesMap.mock';
import {
  isExplicitlyChanged,
  isPendingReset,
} from '../../../../../../snyk/common/languageServer/explicitLsKeyTracking';

/**
 * [IDE-2264 ticket 10]: public-seam read helper — the real `LanguageServerSettings.fromConfiguration`
 * static method wired with the same `isExplicitlyChanged`/`isPendingReset` predicates production code
 * uses (middleware.ts/languageServer.ts), so tests observe a pull response's `changed`/`value` per LS
 * key instead of reaching into the explicit-overrides map's internal entry shape.
 */
async function readPullSetting(
  configuration: IConfiguration,
  explicitOverridesMap: IExplicitOverridesMap,
  lsKey: string,
): Promise<LspConfigSetting | undefined> {
  const lspParam = await LanguageServerSettings.fromConfiguration(
    configuration,
    key => isExplicitlyChanged(key, explicitOverridesMap),
    undefined,
    key => isPendingReset(key, explicitOverridesMap),
  );
  return lspParam.settings?.[lsKey];
}

/**
 * Asserts a pull-response setting's `changed` flag, and — unless `value` is omitted (the
 * `changed:false` case, where no entry exists and the resolved value is irrelevant to this
 * ticket's assertions) — its `value` too: either an exact expected value, or (pass `NOT_NULL`)
 * merely that it isn't the reset sentinel, for callers that can't predict the resolved value.
 */
const NOT_NULL = Symbol('not-null');
function assertPullSetting(
  setting: LspConfigSetting | undefined,
  expected: { changed: boolean; value?: unknown },
  message: string,
): void {
  assert.strictEqual(setting?.changed, expected.changed, message);
  if (expected.value === NOT_NULL) {
    assert.notStrictEqual(setting?.value, null, message);
  } else if ('value' in expected) {
    assert.strictEqual(setting?.value, expected.value, message);
  }
}

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

suite('InboundConfigPersistenceService — persistInbound trusts LS', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  // CP-2.3: real ScopeDetectionService — replaces the old faked stub that returned false
  // unconditionally, which masked the schema-default skip defect (IDE-2149).
  let realScopeService: ScopeDetectionService;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      // CP-2.3: return real schema defaults per key so the real guard never
      // skips an inbound write due to schema-default equality.
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.customEndpoint') {
          return {
            defaultValue: '',
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'allIssuesVsNetNewIssues') {
          return {
            defaultValue: ALLISSUES,
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
      getFeaturesConfiguration: sinon.stub().returns({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      }),
      scanningMode: 'auto',
      organization: '',
      snykApiEndpoint: 'https://api.snyk.io',
      getInsecure: sinon.stub().returns(false),
      getAuthenticationMethod: sinon.stub().returns('oauth'),
      getDeltaFindingsEnabled: sinon.stub().returns(false),
      severityFilter: {},
      issueViewOptions: {},
      riskScoreThreshold: 0,
      getTrustedFolders: sinon.stub().returns([]),
      getCliPath: sinon.stub().resolves(''),
      isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
      getCliBaseDownloadUrl: sinon.stub().returns(''),
    } as unknown as IConfiguration;

    // CP-2.3: wire real ScopeDetectionService so the guard exercises the real predicate.
    // Under the old faked stub (shouldSkipSettingUpdate: stub().returns(false)) these tests
    // would pass even if the guard were broken. The real service uses the ADR-1 predicate.
    realScopeService = new ScopeDetectionService(workspace);

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => {
    sinon.restore();
  });

  test('persists LS endpoint directly without filtering', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      realScopeService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.called(updateConfigurationStub);
  });

  // Regression/proof coverage for a "should fix" raised on PR #782 (a value-unchanged write
  // leaks a marker because no onDidChangeConfiguration event follows a VS Code no-op write).
  // [IDE-2264 ticket 03]: the inbound redundancy check now compares purely against the
  // last-known-value cache — warm from activation-time seeding in production (see
  // extension.ts's `new LastKnownValueCache(workspace, ...)`) — rather than falling back to
  // an override-aware inspectConfiguration peek. A cache hit that matches the incoming value
  // must skip the write entirely.
  test('an inbound value equal to what the last-known-value cache holds for that key is skipped (no write)', async () => {
    const warmCacheWorkspace = {
      updateConfiguration: updateConfigurationStub,
      // Seeds the cache with the pre-existing value, same as activation-time seeding.
      getConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') return 'existing-org';
        return undefined;
      }),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') {
          return {
            defaultValue: '',
            globalValue: 'existing-org',
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;
    const warmCacheScopeService = new ScopeDetectionService(warmCacheWorkspace);

    const lastKnownValueCache = new LastKnownValueCache(warmCacheWorkspace, [ADVANCED_ORGANIZATION]);

    const service = new InboundConfigPersistenceService(
      warmCacheWorkspace,
      configuration,
      warmCacheScopeService,
      logger,
      lastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Same value the cache already holds — a genuine VS Code no-op if written.
        [LS_GLOBAL_KEY.organization]: { value: 'existing-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.notCalled(updateConfigurationStub);
  });

  // [IDE-2264 ticket 03]: a cache miss (nothing written yet this session for this key) must
  // never cause a skip, even when the incoming value happens to equal the schema default —
  // this is the regression the old "effective value" snapshot existed to prevent (a
  // resolved-value-equals-default write silently turning into a permanent override on sync).
  test('the very first inbound push for a key not yet in the cache is never skipped, even if its value equals the schema default', async () => {
    const noOverrideWorkspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'advanced.organization') {
          // The incoming value equals the schema default; no override exists at any scope.
          return {
            defaultValue: 'existing-org',
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;
    const noOverrideScopeService = new ScopeDetectionService(noOverrideWorkspace);

    // Seeded with no tracked keys: the cache has no entry for organization.
    const emptyCache = new LastKnownValueCache(noOverrideWorkspace, []);

    const service = new InboundConfigPersistenceService(
      noOverrideWorkspace,
      configuration,
      noOverrideScopeService,
      logger,
      emptyCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: 'existing-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      'existing-org',
      true,
    );
  });

  // Reviewer finding (PR #782): the last-known-value cache is set BEFORE the write (see
  // applySettingsMap's ordering comment) so the live marking listener sees the right value
  // during the synchronous onDidChangeConfiguration window. A write that then throws must not
  // leave that optimistic value in the cache — it never reached VS Code.
  test('a write that throws reverts the last-known-value cache to its pre-write value', async () => {
    const lastKnownValueCache = new LastKnownValueCache(workspace, []);
    lastKnownValueCache.set(ADVANCED_ORGANIZATION, 'old-org');

    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      realScopeService,
      logger,
      lastKnownValueCache,
    );

    updateConfigurationStub.rejects(new Error('VS Code write failed'));

    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.organization]: { value: 'new-org', changed: true } },
    });

    assert.strictEqual(
      lastKnownValueCache.get(ADVANCED_ORGANIZATION),
      'old-org',
      'a rejected write must not leave the cache holding the optimistic new value',
    );
  });

  test('persistInbound writes delta setting from global settings', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      realScopeService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.scanNetNew]: { value: true, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      DELTA_FINDINGS.replace(`${CONFIGURATION_IDENTIFIER}.`, ''),
      NEWISSUES,
      true,
    );
  });

  test('persistInbound clears folder configs when LS sends empty array', async () => {
    const svc = new InboundConfigPersistenceService(
      workspace,
      configuration,
      realScopeService,
      logger,
      noopLastKnownValueCache,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    const param: LspConfigurationParam = {
      settings: {},
      folderConfigs: [],
    };

    await svc.persistInboundLspConfiguration(param);

    sinon.assert.calledOnce(setFolderConfigsStub);
    assert.deepStrictEqual(setFolderConfigsStub.firstCall.args[0], []);
  });

  test('persistInbound does not call setFolderConfigs when folderConfigs is absent', async () => {
    const svc = new InboundConfigPersistenceService(
      workspace,
      configuration,
      realScopeService,
      logger,
      noopLastKnownValueCache,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setFolderConfigsStub = configuration.setFolderConfigs as unknown as sinon.SinonStub;

    const param: LspConfigurationParam = {
      settings: {},
    };

    await svc.persistInboundLspConfiguration(param);

    sinon.assert.notCalled(setFolderConfigsStub);
  });
});

suite('InboundConfigPersistenceService — global ("Project Defaults") reset', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;
  let explicitOverridesMap: ExplicitOverridesMap;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({
        globalValue: undefined,
        defaultValue: undefined,
      }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
      getFeaturesConfiguration: sinon.stub().returns({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
        secretsEnabled: true,
      }),
      scanningMode: 'auto',
      organization: '',
      snykApiEndpoint: 'https://api.snyk.io',
      getInsecure: sinon.stub().returns(false),
      getAuthenticationMethod: sinon.stub().returns('oauth'),
      getDeltaFindingsEnabled: sinon.stub().returns(false),
      getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
      getAdditionalCliParameters: sinon.stub().returns(''),
      getAdditionalCliEnvironment: sinon.stub().returns(undefined),
      getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
      getAutoConfigureMcpServer: sinon.stub().returns(false),
      severityFilter: {},
      issueViewOptions: {},
      riskScoreThreshold: 0,
      getTrustedFolders: sinon.stub().returns([]),
      getCliPath: sinon.stub().resolves(''),
      isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
      getCliBaseDownloadUrl: sinon.stub().returns(''),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;

    explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
  });

  teardown(() => {
    sinon.restore();
  });

  function newService(): InboundConfigPersistenceService {
    return new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );
  }

  // 3(a): inbound { value: null, changed: true } clears the global value.
  // [IDE-2264 ticket 03/09]: the inbound path never writes to the explicit-overrides map —
  // structurally, not via a suppression check (this class has no reference to the map at all)
  // — so a pre-existing entry for the key is left untouched by this reset, unlike the deleted
  // tracker's unmark-on-reset behavior.
  test('clears the global VS Code value on reset, without touching the explicit-overrides map', async () => {
    // A pre-existing explicit override recorded via the outbound (webview-save) path.
    explicitOverridesMap.setExplicitValue(LS_GLOBAL_KEY.organization, 'acme-corp');

    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // (a1) update(section, undefined, Global=true) — removes the override rather than writing null.
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );

    // (a2) the inbound path has no access to the explicit-overrides map; the pre-existing entry
    // is left exactly as it was — proven through the real pull read path: still reported as an
    // explicit change (changed:true) with a resolved value, not converted into a reset sentinel
    // (which would surface as value:null).
    const setting = await readPullSetting(configuration, explicitOverridesMap, LS_GLOBAL_KEY.organization);
    assertPullSetting(
      setting,
      { changed: true, value: NOT_NULL },
      'the pre-existing explicit override must remain in place, not turned into a reset entry',
    );
  });

  // Reviewer finding (PR #782): applyVscodeKeyResets sets the cache to `undefined` before the
  // write, for the same reason as applySettingsMap. A rejected reset write must not leave that
  // guess in place.
  test('a rejected reset write reverts the last-known-value cache to its pre-reset value', async () => {
    const lastKnownValueCache = new LastKnownValueCache(workspace, []);
    lastKnownValueCache.set(ADVANCED_ORGANIZATION, 'old-org');

    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      lastKnownValueCache,
    );

    updateConfigurationStub.rejects(new Error('VS Code write failed'));

    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.organization]: { value: null, changed: true } },
    });

    assert.strictEqual(
      lastKnownValueCache.get(ADVANCED_ORGANIZATION),
      'old-org',
      'a rejected reset write must not leave the cache holding the optimistic undefined',
    );
  });

  // Regression (PR #782 review r3657978700): a successful reset must seed the cache with the
  // actual post-clear value, not unconditionally `undefined`. `scanningMode` has a package.json
  // schema default ('auto'), so clearing its override resolves to 'auto', not undefined — a
  // stale `undefined` cache entry would make a later onDidChangeConfiguration event (which reads
  // 'auto' via getConfiguration) look like a genuine external edit and re-mark it explicit.
  test('seeds the last-known-value cache with the schema default (not undefined) after a successful reset', async () => {
    (workspace.inspectConfiguration as sinon.SinonStub)
      .withArgs(CONFIGURATION_IDENTIFIER, 'scanningMode')
      .returns({ globalValue: 'manual', defaultValue: 'auto' });

    const lastKnownValueCache = new LastKnownValueCache(workspace, []);
    lastKnownValueCache.set(SCANNING_MODE, 'manual');

    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      lastKnownValueCache,
    );

    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.scanAutomatic]: { value: null, changed: true } },
    });

    assert.strictEqual(
      lastKnownValueCache.get(SCANNING_MODE),
      'auto',
      'the cache must hold the resolved schema default, not undefined',
    );
  });

  // The reset value (null) must never be persisted as an actual setting value.
  test('does not write null as a value for the reset key', async () => {
    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    const wroteNull = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.organization' && c.args[2] === null);
    assert.strictEqual(wroteNull, false, 'reset must not persist null as a setting value');
  });

  // Non-reset entries alongside a reset are still persisted normally.
  test('persists non-reset entries while resetting reset entries', async () => {
    const service = newService();

    const param: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
        [LS_GLOBAL_KEY.apiEndpoint]: { value: 'https://from-ls.example', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // reset → undefined
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
    // non-reset → value written
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.customEndpoint',
      'https://from-ls.example',
      true,
    );
  });
});

// ── FIX 1: applyGlobalResets (INBOUND) must be scoped to GLOBAL_RESET_FIELDS ─
// A key NOT in GLOBAL_RESET_FIELDS that arrives as { value: null, changed: true }
// must NOT trigger updateConfiguration(..., undefined, ...) via the inbound reset path.
suite('InboundConfigPersistenceService — inbound reset scope (FIX 1)', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // api_endpoint is NOT in GLOBAL_RESET_FIELDS; an inbound {value:null, changed:true}
  // for it must NOT call updateConfiguration with undefined (which would silently wipe
  // the user's custom endpoint setting).
  test('inbound {value:null,changed:true} for a non-resettable key (api_endpoint) does NOT clear VS Code setting', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // updateConfiguration must NOT have been called with (_, _, undefined, true)
    // for api_endpoint (snyk.advanced.customEndpoint).
    const clearedEndpoint = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedEndpoint,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; inbound null must NOT clear the VS Code setting',
    );
  });

  // A key that IS in GLOBAL_RESET_FIELDS (organization) must still be handled correctly
  // even when a non-resettable key is present in the same batch.
  test('inbound {value:null,changed:true} for a resettable key (organization) still clears VS Code setting', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
        [LS_GLOBAL_KEY.organization]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });
});

suite('InboundConfigPersistenceService — withoutGlobalResets GLOBAL_RESET_FIELDS scope (FIX 2)', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // api_endpoint (LS_KEY.apiEndpoint) is NOT in GLOBAL_RESET_FIELDS. When it arrives as
  // {value:null, changed:true}, withoutGlobalResets must keep it in the result map so that
  // the write path processes it (rather than silently dropping it as if it were a reset).
  //
  // mapLspSettingsToVscodeSettings skips null values (value===null means nothing to write),
  // so the observable assertion is that updateConfiguration is NOT called with the endpoint
  // value AND the inbound null is not silently swallowed before reaching mapLspSettingsToVscodeSettings.
  // We verify via a spy on workspace.getConfiguration — if the key was retained, the flow
  // continues past withoutGlobalResets. The simplest observable: assert updateConfiguration
  // is never called with (_, 'advanced.customEndpoint', undefined, true) — i.e. the inbound
  // null was NOT treated as a reset (which would clear the VS Code setting).
  test('non-GLOBAL_RESET_FIELDS key with {value:null,changed:true} is NOT dropped by withoutGlobalResets (not treated as reset)', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    // api_endpoint is NOT in GLOBAL_RESET_FIELDS.
    // Send it as {value:null, changed:true} — must NOT be treated as a global reset.
    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // The key must NOT have been cleared as a global reset (updateConfiguration with undefined).
    const clearedAsReset = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedAsReset,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; withoutGlobalResets must not drop or treat it as a reset',
    );
  });

  // FIX: mapLspSettingsToVscodeSettings must skip null values (same as undefined).
  // A non-GLOBAL_RESET_FIELDS key arriving as {value:null, changed:true} must NOT cause
  // updateConfiguration to be called with null as the value — that would silently clear
  // or garble the user's VS Code setting.
  test('non-GLOBAL_RESET_FIELDS key with {value:null,changed:true} does NOT write null to VS Code settings', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    // api_endpoint is NOT in GLOBAL_RESET_FIELDS.
    // Send it as {value:null, changed:true} — mapLspSettingsToVscodeSettings must skip it.
    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // updateConfiguration must NOT be called with null as the value for the endpoint setting.
    const wroteNull = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === null);
    assert.strictEqual(
      wroteNull,
      false,
      'mapLspSettingsToVscodeSettings must skip null values; null must not be written to VS Code settings',
    );
  });

  // Positive case: a non-GLOBAL_RESET_FIELDS key with a real (non-null) value arriving
  // alongside another non-GLOBAL_RESET_FIELDS null key — both reach the write path.
  // The null key is retained by withoutGlobalResets (not a reset-field drop); null values
  // are simply not written by mapLspSettingsToVscodeSettings (they are undefined-valued in
  // the registry lookup). The non-null key IS written.
  test('non-GLOBAL_RESET_FIELDS key with a real value is written normally when a null sibling is present', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Not in GLOBAL_RESET_FIELDS — null, but must not be treated as a reset.
        [LS_KEY.apiEndpoint]: { value: null, changed: true },
        // Not in GLOBAL_RESET_FIELDS — real value, must be written.
        [LS_KEY.organization]: { value: 'my-org', changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // organization (LS_KEY.organization) has vscodeKey ADVANCED_ORGANIZATION;
    // it is NOT in GLOBAL_RESET_FIELDS so it must be written via the normal path.
    sinon.assert.calledWith(updateConfigurationStub, CONFIGURATION_IDENTIFIER, 'advanced.organization', 'my-org', true);
  });
});

// ── Defect 1: the inbound redundancy check must compare against the FULLY-MERGED value ──
//
// Multiple LS keys map to one vscodeKey: all four severity_filter_* keys → snyk.severity,
// and issue_view_open_issues / issue_view_ignored_issues → snyk.issueViewOptions. Each
// inbound push writes the value merged with the current VS Code state (applySettingsMap's
// own object-merge step) and stores that same merged value in the last-known-value cache.
// If a future change ever stored a partial object instead (e.g. last-writer-wins across the
// fan-out group), a second identical push would compare the merged incoming value against a
// stale partial cache entry and spuriously rewrite on every sync.
//
// These tests probe that the cache holds the fully-merged shape via a second inbound push.
suite('InboundConfigPersistenceService — snapshot merges shared-vscodeKey partials (Defect 1)', () => {
  let updateConfigStub: sinon.SinonStub;
  let workspace: IVSCodeWorkspace;
  let realScopeService: ScopeDetectionService;
  let lastKnownValueCache: LastKnownValueCache;

  setup(() => {
    updateConfigStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigStub,
      // getConfiguration returns the merged severity object (as VS Code would after a prior write).
      getConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'severity') {
          return { critical: true, high: true, medium: true, low: true };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'issueViewOptions') {
          return { openIssues: true, ignoredIssues: true };
        }
        return undefined;
      }),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      // User has an explicit global override for severity (so scope = 'user' → guard checks globalValue).
      inspectConfiguration: sinon.stub().callsFake((configId: string, section: string) => {
        if (configId === CONFIGURATION_IDENTIFIER && section === 'severity') {
          return {
            defaultValue: { critical: true, high: true, medium: true, low: true },
            globalValue: { critical: true, high: true, medium: true, low: true },
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        if (configId === CONFIGURATION_IDENTIFIER && section === 'issueViewOptions') {
          return {
            defaultValue: { openIssues: true, ignoredIssues: true },
            globalValue: { openIssues: true, ignoredIssues: true },
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        }
        return {
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }),
    } as unknown as IVSCodeWorkspace;

    realScopeService = new ScopeDetectionService(workspace);
    // Empty seed: each test's first inbound push populates it, mirroring a fresh session.
    lastKnownValueCache = new LastKnownValueCache(workspace, []);
  });

  teardown(() => sinon.restore());

  function newService(): InboundConfigPersistenceService {
    return new InboundConfigPersistenceService(
      workspace,
      {
        getToken: sinon.stub().resolves('tok'),
        setToken: sinon.stub().resolves(),
        getFolderConfigs: sinon.stub().returns([]),
        setFolderConfigs: sinon.stub().resolves(),
        getFeaturesConfiguration: sinon.stub().returns({
          ossEnabled: true,
          codeSecurityEnabled: true,
          iacEnabled: true,
          secretsEnabled: true,
        }),
        scanningMode: 'auto',
        organization: '',
        snykApiEndpoint: 'https://api.snyk.io',
        getInsecure: sinon.stub().returns(false),
        getAuthenticationMethod: sinon.stub().returns('oauth'),
        getDeltaFindingsEnabled: sinon.stub().returns(false),
        getOssQuickFixCodeActionsEnabled: sinon.stub().returns(true),
        getAdditionalCliParameters: sinon.stub().returns(''),
        getSecureAtInceptionExecutionFrequency: sinon.stub().returns('Manual'),
        getAutoConfigureMcpServer: sinon.stub().returns(false),
        severityFilter: { critical: true, high: true, medium: true, low: true },
        issueViewOptions: { openIssues: true, ignoredIssues: true },
        riskScoreThreshold: 0,
        getTrustedFolders: sinon.stub().returns([]),
        getCliPath: sinon.stub().resolves(''),
        isAutomaticDependencyManagementEnabled: sinon.stub().returns(true),
        getCliBaseDownloadUrl: sinon.stub().returns(''),
      } as unknown as IConfiguration,
      realScopeService,
      { info: sinon.stub(), debug: sinon.stub(), error: sinon.stub(), warn: sinon.stub() } as unknown as ILog,
      lastKnownValueCache,
    );
  }

  // Defect 1a: after a full severity batch inbound, an identical second inbound push must be
  // SKIPPED. RED reason (before fix): snapshot holds only the last-written partial {low:true};
  //   _.isEqual({critical,high,medium,low}, {low:true}) = false → guard always writes → spurious update.
  test('Defect1a: a second identical inbound severity batch is skipped (no spurious write)', async () => {
    const service = newService();

    // First inbound push: LS sends all four severity keys (effective = all enabled).
    const inboundAllSeverity: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.severityFilterCritical]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterHigh]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterMedium]: { value: true, changed: false },
        [LS_GLOBAL_KEY.severityFilterLow]: { value: true, changed: false },
      },
    };
    await service.persistInboundLspConfiguration(inboundAllSeverity);
    updateConfigStub.reset();

    // Second, identical inbound push → must be skipped against the merged snapshot (no-op).
    await service.persistInboundLspConfiguration(inboundAllSeverity);

    const severityWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === 'severity');

    assert.strictEqual(
      severityWrites.length,
      0,
      `Defect1a regression: a second identical inbound push must be skipped against the last-known-value ` +
        `cache. Got ${severityWrites.length} write(s). A write here means the cache held a partial object ` +
        `instead of the fully-merged value (last-writer-wins reintroduced), so the merged incoming value no ` +
        `longer equals the cached value and the guard never skips.`,
    );
  });

  // Defect 1b: same for issueViewOptions (two LS keys → one vscodeKey).
  test('Defect1b: a second identical inbound issueViewOptions batch is skipped', async () => {
    const service = newService();

    const inboundIssueView: LspConfigurationParam = {
      settings: {
        [LS_GLOBAL_KEY.issueViewOpenIssues]: { value: true, changed: false },
        [LS_GLOBAL_KEY.issueViewIgnoredIssues]: { value: true, changed: false },
      },
    };
    await service.persistInboundLspConfiguration(inboundIssueView);
    updateConfigStub.reset();

    // Second, identical inbound push → must be skipped.
    await service.persistInboundLspConfiguration(inboundIssueView);

    const issueViewWrites = updateConfigStub
      .getCalls()
      .filter(c => c.args[0] === CONFIGURATION_IDENTIFIER && c.args[1] === 'issueViewOptions');

    assert.strictEqual(
      issueViewWrites.length,
      0,
      `Defect1b regression: a second identical inbound push must be skipped against the last-known-value ` +
        `cache. Got ${issueViewWrites.length} write(s). A write here means the cache held a partial ` +
        `{ignoredIssues:true} instead of the fully-merged issueView value, so ` +
        `isEqual({openIssues,ignoredIssues}, {ignoredIssues}) is false and the guard never skips.`,
    );
  });
});

// ── Fix 2: undefined value must be treated as reset for GLOBAL_RESET_FIELDS keys ─
//
// The LS may encode a reset as { changed: true } with the `value` field OMITTED,
// producing { value: undefined, changed: true } when the field is missing.  The old
// isGlobalReset guard used `value === null` (strict), which missed this case.
//
// The fix broadens the guard to `value == null` (loose — matches null OR undefined)
// while preserving the GLOBAL_RESET_FIELDS allowlist gate.
//
// Non-resettable keys with { value: undefined, changed: true } must NOT trigger
// a reset (the GLOBAL_RESET_FIELDS guard is unchanged).
suite('InboundConfigPersistenceService — Fix 2: undefined value treated as reset for GLOBAL_RESET_FIELDS', () => {
  let workspace: IVSCodeWorkspace;
  let configuration: IConfiguration;
  let scopeDetectionService: IScopeDetectionService;
  let logger: ILog;
  let updateConfigurationStub: sinon.SinonStub;

  setup(() => {
    updateConfigurationStub = sinon.stub().resolves();
    workspace = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub().returns(undefined),
      getWorkspaceFolders: sinon.stub().returns([]),
      getWorkspaceFolderPaths: sinon.stub().returns([]),
      inspectConfiguration: sinon.stub().returns({ globalValue: undefined, defaultValue: undefined }),
    } as unknown as IVSCodeWorkspace;

    configuration = {
      getToken: sinon.stub().resolves('tok'),
      setToken: sinon.stub().resolves(),
      getFolderConfigs: sinon.stub().returns([]),
      setFolderConfigs: sinon.stub().resolves(),
    } as unknown as IConfiguration;

    scopeDetectionService = {
      getSettingScope: sinon.stub().returns('user'),
      populateScopeIndicators: sinon.stub().returns(''),
      shouldSkipSettingUpdate: sinon.stub().returns(false),
    } as unknown as IScopeDetectionService;

    logger = {
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as ILog;
  });

  teardown(() => sinon.restore());

  // LS sends { changed: true } with value field absent → JS produces { value: undefined }.
  // For a GLOBAL_RESET_FIELDS key this must trigger the reset path (clear VS Code override).
  test('inbound {value:undefined, changed:true} for a GLOBAL_RESET_FIELDS key (organization) triggers reset', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        // Simulate a missing value field: { changed: true } with no value key.
        [LS_GLOBAL_KEY.organization]: { value: undefined as unknown as null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // The reset path must have been triggered: updateConfiguration called with undefined value.
    sinon.assert.calledWith(
      updateConfigurationStub,
      CONFIGURATION_IDENTIFIER,
      'advanced.organization',
      undefined,
      true,
    );
  });

  // A non-resettable key with { value: undefined, changed: true } must NOT trigger a reset.
  // The GLOBAL_RESET_FIELDS allowlist gate must remain intact regardless of the null broadening.
  test('inbound {value:undefined, changed:true} for a non-GLOBAL_RESET_FIELDS key (api_endpoint) does NOT trigger reset', async () => {
    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      scopeDetectionService,
      logger,
      noopLastKnownValueCache,
    );

    const param: LspConfigurationParam = {
      settings: {
        [LS_KEY.apiEndpoint]: { value: undefined as unknown as null, changed: true },
      },
    };

    await service.persistInboundLspConfiguration(param);

    // Must NOT have cleared api_endpoint — not a resettable key.
    const clearedEndpoint = updateConfigurationStub
      .getCalls()
      .some(c => c.args[1] === 'advanced.customEndpoint' && c.args[2] === undefined);
    assert.strictEqual(
      clearedEndpoint,
      false,
      'api_endpoint is not in GLOBAL_RESET_FIELDS; {value:undefined, changed:true} must not clear it',
    );
  });
});
