// ABOUTME: End-to-end tests for the explicit-overrides map as the sole source of pull `changed`
// ABOUTME: Wires only real production objects — no hand-marked fakes for map or read path (ticket 09)
import assert from 'assert';
import sinon from 'sinon';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  IConfiguration,
} from '../../../../snyk/common/configuration/configuration';
import { ConfigurationPersistenceService } from '../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { InboundConfigPersistenceService } from '../../../../snyk/common/views/workspaceConfiguration/services/inboundConfigPersistenceService';
import { IScopeDetectionService } from '../../../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import {
  markExplicitLsKeysFromConfigurationChangeEvent,
  seedExplicitChangesFromExistingSettings,
} from '../../../../snyk/common/languageServer/explicitLsKeyTracking';
import { ExplicitOverridesMap } from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { LastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import { VSCODE_KEY_TO_LS_KEYS } from '../../../../snyk/common/languageServer/lsKeyToVscodeKeyMap';
import { LS_GLOBAL_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import { ADVANCED_ORGANIZATION, SEVERITY_FILTER_SETTING } from '../../../../snyk/common/constants/settings';
import type {
  CancellationToken,
  ConfigurationChangeEvent,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
} from '../../../../snyk/common/vscode/types';
import type { LspConfigurationParam, ShowIssueDetailTopicParams } from '../../../../snyk/common/languageServer/types';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { LoggerMockFailOnErrors } from '../../mocks/logger.mock';
import { Subject } from 'rxjs';

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

/**
 * A real (if minimal) VS Code settings backing store, keyed by `${configurationId}.${section}`.
 * Unlike a per-call stub, writes made via `updateConfiguration` are visible to subsequent
 * `getConfiguration`/`inspectConfiguration` calls — needed so a save's effect is observable by
 * the read path that runs afterward, the same way real settings.json read-after-write works.
 */
function makeFakeWorkspace(initial: Record<string, unknown> = {}): IVSCodeWorkspace {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
    inspectConfiguration: (configId: string, section: string) => {
      const key = `${configId}.${section}`;
      return { globalValue: store.get(key), defaultValue: undefined };
    },
    updateConfiguration: (configId: string, section: string, value: unknown) => {
      const key = `${configId}.${section}`;
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
      return Promise.resolve();
    },
    getWorkspaceFolders: () => [],
    getWorkspaceFolderPaths: () => [],
  } as unknown as IVSCodeWorkspace;
}

/**
 * Same backing store as {@link makeFakeWorkspace}, but also supports `onDidChangeConfiguration`:
 * every `updateConfiguration` write dispatches synchronously to registered listeners before
 * returning — matching real VS Code (per the marker's own doc comments: listeners for one write
 * run synchronously, back-to-back, strictly before the write's own `await` continuation resumes).
 * Needed to reproduce a real inbound-write race against the live config-change listener.
 */
function makeReactiveFakeWorkspace(initial: Record<string, unknown> = {}): IVSCodeWorkspace {
  const store = new Map<string, unknown>(Object.entries(initial));
  const listeners: Array<(e: ConfigurationChangeEvent) => unknown> = [];
  return {
    getConfiguration: (configId: string, section: string) => store.get(`${configId}.${section}`),
    inspectConfiguration: (configId: string, section: string) => {
      const key = `${configId}.${section}`;
      return { globalValue: store.get(key), defaultValue: undefined };
    },
    updateConfiguration: (configId: string, section: string, value: unknown) => {
      const key = `${configId}.${section}`;
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
      const event = { affectsConfiguration: (k: string) => k === key } as ConfigurationChangeEvent;
      for (const listener of listeners) listener(event);
      return Promise.resolve();
    },
    onDidChangeConfiguration: (listener: (e: ConfigurationChangeEvent) => unknown) => {
      listeners.push(listener);
      return { dispose: () => undefined };
    },
    getWorkspaceFolders: () => [],
    getWorkspaceFolderPaths: () => [],
  } as unknown as IVSCodeWorkspace;
}

/** Full IConfiguration fixture — every SETTINGS_REGISTRY entry's `resolve` must run without throwing. */
function makeConfiguration(overrides: Partial<IConfiguration> = {}): IConfiguration {
  return {
    getAuthenticationMethod: () => 'oauth',
    shouldReportErrors: false,
    snykApiEndpoint: 'https://dev.snyk.io/api',
    getAdditionalCliParameters: () => '',
    getAdditionalCliEnvironment: () => '',
    organization: 'seed-org',
    getToken: () => Promise.resolve('token'),
    setToken: () => Promise.resolve(),
    isAutomaticDependencyManagementEnabled: () => true,
    getCliPath: () => Promise.resolve('/path/to/cli'),
    getCliBaseDownloadUrl: () => 'https://downloads.snyk.io',
    getInsecure: () => true,
    getDeltaFindingsEnabled: () => false,
    getPreviewFeatures: () => ({}),
    getOssQuickFixCodeActionsEnabled: () => true,
    getFeaturesConfiguration: () => defaultFeaturesConfigurationStub,
    severityFilter: DEFAULT_SEVERITY_FILTER,
    riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
    issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
    getTrustedFolders: () => ['/trusted/test/folder'],
    getFolderConfigs: () => [],
    setFolderConfigs: () => Promise.resolve(),
    getSecureAtInceptionExecutionFrequency: () => 'Manual',
    getAutoConfigureMcpServer: () => false,
    ...overrides,
  } as unknown as IConfiguration;
}

const fakeScopeDetectionService: IScopeDetectionService = {
  getSettingScope: () => 'user',
  populateScopeIndicators: () => '',
  shouldSkipSettingUpdate: () => false,
} as unknown as IScopeDetectionService;

const fakeClientAdapter: ILanguageClientAdapter = {
  getLanguageClient: () => ({ sendNotification: sinon.stub().resolves() }),
} as unknown as ILanguageClientAdapter;

/** Real production read path: middleware's workspace/configuration pull handler. */
async function pullLspConfiguration(
  configuration: IConfiguration,
  explicitOverridesMap: ExplicitOverridesMap,
  lastKnownValueCache: LastKnownValueCache,
  vscodeWorkspace: IVSCodeWorkspace,
): Promise<Record<string, { value: unknown; changed: boolean }>> {
  const middleware = new LanguageClientMiddleware(
    new LoggerMockFailOnErrors(),
    configuration,
    new Subject<ShowIssueDetailTopicParams>(),
    {} as IUriAdapter,
    {} as IVSCodeCommands,
    vscodeWorkspace,
    lastKnownValueCache,
    explicitOverridesMap,
  );

  const params: ConfigurationParams = { items: [{ section: 'snyk' }] };
  const token: CancellationToken = { isCancellationRequested: false, onCancellationRequested: sinon.fake() };
  const handler: ConfigurationRequestHandlerSignature = (_params, _token) => [{}];

  const res = await middleware.workspace.configuration(params, token, handler);
  if (res instanceof Error) {
    assert.fail('middleware.workspace.configuration returned an error');
  }
  const pullItem = (res as Array<{ settings: LspConfigurationParam }>)[0];
  return pullItem.settings.settings as Record<string, { value: unknown; changed: boolean }>;
}

suite('IDE-2264 ticket 09: explicit-overrides map end-to-end (real objects only)', () => {
  teardown(() => sinon.restore());

  // Reproduces the ticket's core bug report verbatim: seeding at activation only ever wrote
  // the OLD tracker; a genuine post-activation change wrote only to the (unread) map, so it
  // never reached the LS pull response. Here, `organization` starts untouched at activation
  // (seeding is a no-op for it), then a webview save sets it for the first time — the real
  // middleware/ConfigurationPersistenceService/ExplicitOverridesMap wiring must surface
  // `changed:true` on the very next pull.
  test('a post-activation webview save surfaces as changed:true on the real pull read path', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace(); // untouched at "activation" — no pre-existing org
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    // Simulated activation: seeds the map from pre-existing settings. A no-op here since
    // organization has no pre-existing global value — the gap the ticket describes, proven
    // below by the pull surfacing changed:true after a genuine post-activation change.
    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    const service = new ConfigurationPersistenceService(
      workspace,
      makeConfiguration(),
      fakeScopeDetectionService,
      fakeClientAdapter,
      new LoggerMockFailOnErrors(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );

    // Post-activation webview save: a genuine explicit change.
    await service.handleSaveConfig(
      JSON.stringify({ isFallbackForm: false, token: 'tok', [LS_GLOBAL_KEY.organization]: 'acme-corp' }),
    );

    // The live IConfiguration used by the read path must reflect the same setting the save
    // just wrote — exactly as the real Configuration class (backed by the same workspace)
    // would on its next read.
    const configuration = makeConfiguration({ organization: 'acme-corp' });

    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.organization]?.value, 'acme-corp');
    assert.strictEqual(
      settings[LS_GLOBAL_KEY.organization]?.changed,
      true,
      'a post-activation explicit change must surface as changed:true on the real read path',
    );
  });

  // Covers the reset-after-value transition: a key seeded as an explicit 'value' at activation
  // is later reset via the webview's "Project Defaults" action — the map entry must transition
  // 'value' -> 'reset', and the real read path must reflect it as {value:null, changed:true}.
  test('a reset after a prior explicit value transitions the map entry and the real pull reflects it', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace({ 'snyk.advanced.organization': 'seed-org' });
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    const service = new ConfigurationPersistenceService(
      workspace,
      makeConfiguration(),
      fakeScopeDetectionService,
      fakeClientAdapter,
      new LoggerMockFailOnErrors(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );

    await service.handleSaveConfig(
      JSON.stringify({ isFallbackForm: false, token: 'tok', [LS_GLOBAL_KEY.organization]: null }),
    );

    const configuration = makeConfiguration({ organization: 'seed-org' });
    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.organization]?.value, null);
    assert.strictEqual(settings[LS_GLOBAL_KEY.organization]?.changed, true);
  });

  // Covers sibling fan-out isolation: severity_filter_critical and severity_filter_high share
  // one VS Code setting (snyk.severity). Saving only the critical field must surface
  // changed:true for critical alone on the real read path — the untouched sibling must remain
  // changed:false, proving the map (not the shared vscodeKey) is what the predicate keys off.
  test('a sibling fan-out edit surfaces changed:true only for the edited key on the real pull read path', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace();
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    const service = new ConfigurationPersistenceService(
      workspace,
      makeConfiguration(),
      fakeScopeDetectionService,
      fakeClientAdapter,
      new LoggerMockFailOnErrors(),
      undefined,
      explicitOverridesMap,
      lastKnownValueCache,
    );

    await service.handleSaveConfig(
      JSON.stringify({ isFallbackForm: false, token: 'tok', [LS_GLOBAL_KEY.severityFilterCritical]: false }),
    );

    const configuration = makeConfiguration({ severityFilter: { ...DEFAULT_SEVERITY_FILTER, critical: false } });
    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.severityFilterCritical]?.value, false);
    assert.strictEqual(settings[LS_GLOBAL_KEY.severityFilterCritical]?.changed, true);
    assert.strictEqual(
      settings[LS_GLOBAL_KEY.severityFilterHigh]?.changed,
      false,
      'untouched sibling must not be marked changed just because it shares a VS Code setting',
    );
  });

  // Happy-path inbound write: the LS pushing its own resolved value down (e.g. an org-level
  // default synced on connect) is not a user action and must never be recorded in the
  // explicit-overrides map — only outbound (webview save / direct edit) paths touch it. The
  // real read path must therefore report the newly-written value with changed:false.
  test('an inbound LS push writes the setting but leaves the explicit-overrides map untouched (changed:false)', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace();
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    const service = new InboundConfigPersistenceService(
      workspace,
      makeConfiguration(),
      fakeScopeDetectionService,
      new LoggerMockFailOnErrors(),
      lastKnownValueCache,
    );

    await service.persistInboundLspConfiguration({
      settings: { [LS_GLOBAL_KEY.apiEndpoint]: { value: 'https://org.snyk.io/api', changed: false } },
    });

    assert.strictEqual(
      workspace.getConfiguration('snyk', 'advanced.customEndpoint'),
      'https://org.snyk.io/api',
      'the inbound value must be persisted to VS Code settings',
    );

    const configuration = makeConfiguration({ snykApiEndpoint: 'https://org.snyk.io/api' });
    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.apiEndpoint]?.value, 'https://org.snyk.io/api');
    assert.strictEqual(
      settings[LS_GLOBAL_KEY.apiEndpoint]?.changed,
      false,
      'a value the LS itself pushed must not echo back as changed:true',
    );
  });

  // Happy-path manual settings.json edit: exercises the OTHER outbound write path —
  // markExplicitLsKeysFromConfigurationChangeEvent, driven by a real onDidChangeConfiguration-
  // shaped event — instead of the webview-save path the other tests use. Proves the real
  // read path surfaces changed:true regardless of which of the two outbound writers recorded
  // the entry.
  test('a manual settings.json edit surfaces as changed:true on the real pull read path', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace(); // untouched at "activation" — no pre-existing org
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    // The user hand-edits settings.json: the value is now on disk, but the last-known-value
    // cache (still holding the pre-edit snapshot from "activation") hasn't observed it yet —
    // exactly the state VS Code's onDidChangeConfiguration listener fires into.
    const configuration = makeConfiguration({ organization: 'hand-edited-org' });
    await workspace.updateConfiguration('snyk', 'advanced.organization', 'hand-edited-org');
    const changeEvent = { affectsConfiguration: (key: string) => key === ADVANCED_ORGANIZATION };

    await markExplicitLsKeysFromConfigurationChangeEvent(
      changeEvent,
      explicitOverridesMap,
      lastKnownValueCache,
      workspace,
      configuration,
    );

    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.organization]?.value, 'hand-edited-org');
    assert.strictEqual(
      settings[LS_GLOBAL_KEY.organization]?.changed,
      true,
      'a direct settings.json edit must surface as changed:true on the real read path',
    );
  });

  // Happy-path manual settings.json edit on a FAN-OUT sibling: the direct-edit path's fan-out
  // disambiguation branch (explicitLsKeyTracking.ts's per-sibling projection loop) is otherwise
  // only unit-tested with a hand-rolled predicate — this proves it through the real read path,
  // the same way the webview-save fan-out case above proves it for the other outbound writer.
  test('a manual settings.json edit on one fan-out sibling surfaces changed:true only for that key', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeFakeWorkspace(); // untouched at "activation" — no pre-existing severity override
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    // The user hand-edits settings.json, flipping only `critical` in the shared `snyk.severity`
    // object — the last-known-value cache still holds the pre-edit (absent) snapshot.
    const editedSeverity = { ...DEFAULT_SEVERITY_FILTER, critical: false };
    const configuration = makeConfiguration({ severityFilter: editedSeverity });
    await workspace.updateConfiguration('snyk', 'severity', editedSeverity);
    const changeEvent = { affectsConfiguration: (key: string) => key === SEVERITY_FILTER_SETTING };

    await markExplicitLsKeysFromConfigurationChangeEvent(
      changeEvent,
      explicitOverridesMap,
      lastKnownValueCache,
      workspace,
      configuration,
    );

    const settings = await pullLspConfiguration(configuration, explicitOverridesMap, lastKnownValueCache, workspace);

    assert.strictEqual(settings[LS_GLOBAL_KEY.severityFilterCritical]?.value, false);
    assert.strictEqual(settings[LS_GLOBAL_KEY.severityFilterCritical]?.changed, true);
    assert.strictEqual(
      settings[LS_GLOBAL_KEY.severityFilterHigh]?.changed,
      false,
      'a sibling untouched by the direct edit must not be marked changed',
    );
  });

  // Regression for PR #782 review residual: a migration batch that writes several
  // previously-unset settings to their own resolved defaults must not mark any of them explicit,
  // even though each individual write fires a real onDidChangeConfiguration event that the
  // (also real, production-wired) direct-edit marking listener reacts to. Reproduces a race in
  // InboundConfigPersistenceService.applySettingsMap: it awaits workspace.updateConfiguration
  // before updating the last-known-value cache, so the marker — invoked synchronously by the
  // same write, per real VS Code's listener-dispatch order — reads the STALE (pre-write) cache
  // entry, sees a "genuine" divergence, and wrongly records an explicit override.
  test('an inbound migration batch writing several previously-unset defaults marks none of them explicit', async () => {
    const explicitOverridesMap = new ExplicitOverridesMap(makeMemento());
    const workspace = makeReactiveFakeWorkspace(); // fresh install — nothing configured yet
    const lastKnownValueCache = new LastKnownValueCache(workspace, Object.keys(VSCODE_KEY_TO_LS_KEYS));

    seedExplicitChangesFromExistingSettings(explicitOverridesMap, workspace);

    const configuration = makeConfiguration({
      snykApiEndpoint: 'https://api.snyk.io',
      getAutoConfigureMcpServer: () => false,
      getSecureAtInceptionExecutionFrequency: () => 'Manual',
    });

    // Registered once, exactly like languageServer.ts's registerExplicitKeyMarkingListener —
    // fire-and-forget from the listener's perspective; the test tracks the promises so it can
    // wait for the (buggy) marking to actually land before asserting.
    const pendingMarks: Promise<void>[] = [];
    workspace.onDidChangeConfiguration(e => {
      pendingMarks.push(
        markExplicitLsKeysFromConfigurationChangeEvent(
          e,
          explicitOverridesMap,
          lastKnownValueCache,
          workspace,
          configuration,
          new LoggerMockFailOnErrors(),
        ),
      );
    });

    const service = new InboundConfigPersistenceService(
      workspace,
      configuration,
      fakeScopeDetectionService,
      new LoggerMockFailOnErrors(),
      lastKnownValueCache,
    );

    // Simulated migration: the LS resolves and pushes its full state for several settings that
    // were never previously configured — all at their own defaults, none genuinely changed.
    await service.persistInboundLspConfiguration({
      settings: {
        [LS_GLOBAL_KEY.apiEndpoint]: { value: 'https://api.snyk.io', changed: false },
        [LS_GLOBAL_KEY.autoConfigureMcpServer]: { value: false, changed: false },
        [LS_GLOBAL_KEY.secureAtInceptionExecutionFreq]: { value: 'Manual', changed: false },
      },
    });

    await Promise.all(pendingMarks);

    for (const lsKey of [
      LS_GLOBAL_KEY.apiEndpoint,
      LS_GLOBAL_KEY.autoConfigureMcpServer,
      LS_GLOBAL_KEY.secureAtInceptionExecutionFreq,
    ]) {
      assert.strictEqual(
        explicitOverridesMap.getEntry(lsKey),
        undefined,
        `${lsKey}: an inbound migration write of an untouched default must not be marked explicit`,
      );
    }
  });
});
