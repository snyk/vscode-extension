import type { ConfigurationChangeEvent } from '../vscode/types';
import { SETTINGS_REGISTRY, VSCODE_KEY_TO_LS_KEYS } from './lsKeyToVscodeKeyMap';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import type { IExplicitOverridesMap } from './explicitOverridesMap';
import type { ILastKnownValueCache } from './lastKnownValueCache';
import type { LspConfigSetting } from './types';
import {
  Configuration,
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_SEVERITY_FILTER,
  type IConfiguration,
} from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import isEqual from 'lodash/isEqual';

/**
 * Projects a single fan-out LS key's sub-value directly out of a raw VS Code setting value
 * (e.g. the whole `snyk.severity` object) — without a live {@link IConfiguration}. Reuses the
 * entry's own `resolve` as the single source of truth for the sub-field name and its default,
 * by handing it a minimal stub exposing only the getters the current fan-out settings
 * (severityFilter, issueViewOptions) read from.
 *
 * A throwing resolver (or an unmapped lsKey) is treated as "value unknown" rather than letting
 * the throw escape — a broken sibling must not abort the fan-out loop for the rest of the group.
 */
function projectFanOutSubValue(lsKey: string, rawVscodeValue: unknown): unknown {
  const entry = SETTINGS_REGISTRY[lsKey as keyof typeof SETTINGS_REGISTRY];
  const stub = {
    severityFilter: (rawVscodeValue as typeof DEFAULT_SEVERITY_FILTER) ?? DEFAULT_SEVERITY_FILTER,
    issueViewOptions: (rawVscodeValue as typeof DEFAULT_ISSUE_VIEW_OPTIONS) ?? DEFAULT_ISSUE_VIEW_OPTIONS,
  } as unknown as IConfiguration;
  try {
    return entry.resolve(stub);
  } catch {
    return undefined;
  }
}

/**
 * Returns the current LS-shaped value for a single-LS-key VS Code setting, via the registry's
 * own `resolve`. Awaiting works uniformly whether `resolve` is sync or returns a Promise (e.g.
 * cliPath) — the explicit-overrides map stores this value directly as the outbound LS value, so
 * an async resolver's real result must not be discarded.
 */
async function resolveCurrentLsValue(lsKey: string, configuration: IConfiguration): Promise<unknown> {
  const entry = SETTINGS_REGISTRY[lsKey as keyof typeof SETTINGS_REGISTRY];
  try {
    return await entry.resolve(configuration);
  } catch {
    return undefined;
  }
}

/**
 * Compares the current VS Code value for `vscodeKey` against the last-known-value cache
 * (ticket 01). Equal means the pending change reflects a write the extension itself already
 * made (or no real change occurred); different means a genuine external edit occurred.
 *
 * Exported so the middleware's independent echo-suppression decision (ticket 05) can run the
 * same stateless comparison against current VS Code state, instead of relying on a shared
 * per-event flag.
 */
export function vscodeValueMatchesLastKnown(
  vscodeKey: string,
  workspace: Pick<IVSCodeWorkspace, 'getConfiguration'>,
  cache: Pick<ILastKnownValueCache, 'get'>,
): boolean {
  const { configurationId, section } = Configuration.getConfigName(vscodeKey);
  return isEqual(workspace.getConfiguration(configurationId, section), cache.get(vscodeKey));
}

/**
 * [IDE-2264 ticket 05]: the middleware's outbound echo-suppression decision. Iterates every
 * tracked VS Code key and reuses {@link vscodeValueMatchesLastKnown} — the same stateless
 * comparison {@link markExplicitLsKeysFromConfigurationChangeEvent} uses — against current VS
 * Code state at the moment it's called. Returns true (forward to the LS) iff at least one
 * tracked key currently differs from the last-known-value cache, i.e. a genuine change is not
 * yet reflected; false (suppress) when every tracked key already matches, i.e. this event is
 * purely an echo of a write the extension itself already made.
 *
 * Computed independently of {@link markExplicitLsKeysFromConfigurationChangeEvent} — no shared
 * per-event flag. The two decisions agree regardless of which of the two `onDidChangeConfiguration`
 * listeners VS Code happens to invoke first for a given event: `markExplicitLsKeysFromConfigurationChangeEvent`
 * defers its own cache mutation to a microtask specifically so this check never observes a
 * same-event write it hasn't run yet.
 */
export function hasUnreflectedConfigurationChange(
  workspace: Pick<IVSCodeWorkspace, 'getConfiguration'>,
  cache: Pick<ILastKnownValueCache, 'get'>,
): boolean {
  return Object.keys(VSCODE_KEY_TO_LS_KEYS).some(
    vscodeKey => !vscodeValueMatchesLastKnown(vscodeKey, workspace, cache),
  );
}

/**
 * When native VS Code configuration changes (a direct settings.json edit or the native
 * Settings UI), marks matching LS keys explicit in the explicit-overrides map so outbound
 * `workspace/didChangeConfiguration` sets `ConfigSetting.changed` for genuine user edits.
 *
 * Uses the pre-computed {@link VSCODE_KEY_TO_LS_KEYS} reverse index directly.
 *
 * Replaces the old write-time pending-tag consumption with a value comparison against the
 * shared last-known-value cache (ticket 01): a VS Code key whose current value matches the
 * cache entry reflects a write the extension itself already made (correct regardless of how
 * much later the event fires) and is left alone; a divergent value is a genuine external edit.
 *
 * For a VS Code key shared by several LS keys (fan-out, e.g. severity filters, issueViewOptions),
 * only the sibling(s) whose own projected sub-value actually changed are marked — the
 * projection is read from the very same cache entry (old vs new raw value), so no separate
 * fan-out-specific cache is needed.
 *
 * Async only for the single-LS-key path, which awaits the registry's `resolve` to get the real
 * value of an async setting (e.g. cliPath) rather than discarding it — the stored value here
 * becomes the outbound LS value, unlike the old boolean-only tracker mark.
 */
export async function markExplicitLsKeysFromConfigurationChangeEvent(
  e: ConfigurationChangeEvent,
  explicitOverrides: IExplicitOverridesMap,
  lastKnownValueCache: ILastKnownValueCache,
  workspace: Pick<IVSCodeWorkspace, 'getConfiguration'>,
  configuration: IConfiguration,
): Promise<void> {
  for (const [vscodeKey, lsKeys] of Object.entries(VSCODE_KEY_TO_LS_KEYS)) {
    if (!e.affectsConfiguration(vscodeKey)) {
      continue;
    }

    const { configurationId, section } = Configuration.getConfigName(vscodeKey);
    const newValue = workspace.getConfiguration(configurationId, section);
    const oldValue = lastKnownValueCache.get(vscodeKey);

    if (isEqual(newValue, oldValue)) {
      // Reflects a write the extension itself already made (its last-known-value cache entry
      // was updated at write time) — not a genuine external edit. Take no action.
      continue;
    }

    // [IDE-2264 ticket 05]: deferred rather than applied immediately. VS Code invokes every
    // onDidChangeConfiguration listener for this one event synchronously, back-to-back —
    // including the language client's own internal listener that drives
    // LanguageClientMiddleware.didChangeConfiguration's independent hasUnreflectedConfigurationChange
    // check. Mutating the cache here immediately would make that check's outcome depend on
    // whether it happens to run before or after this listener for the same event. Queuing the
    // mutation as a microtask guarantees every listener for THIS event observes the pre-mutation
    // value, regardless of registration order — it still lands well before the next distinct
    // configuration-change event or LS pull can observe it.
    queueMicrotask(() => lastKnownValueCache.set(vscodeKey, newValue));

    if (lsKeys.length === 1) {
      // VS Code only fires the event when the value actually changed, and the whole-value
      // compare above already confirmed that — mark unconditionally.
      explicitOverrides.setExplicitValue(lsKeys[0], await resolveCurrentLsValue(lsKeys[0], configuration));
      continue;
    }

    // Fan-out: multiple LS keys share one VS Code setting. Mark only the siblings whose own
    // projected sub-value actually changed, not every sibling sharing the VS Code key.
    for (const lsKey of lsKeys) {
      const oldProjected = projectFanOutSubValue(lsKey, oldValue);
      const newProjected = projectFanOutSubValue(lsKey, newValue);
      if (isEqual(oldProjected, newProjected)) {
        continue;
      }
      explicitOverrides.setExplicitValue(lsKey, newProjected);
    }
  }
}

/**
 * Seeds the tracker with LS keys whose VS Code global setting value differs from
 * the registered default.  Call once immediately after constructing the tracker
 * so that pre-existing user customisations are honoured on the first
 * `workspace/didChangeConfiguration` even if the user has never saved the
 * settings form in the current session.
 *
 * Rules:
 * - Skips `alwaysChanged` entries — they are always emitted with `changed: true`.
 * - Skips entries without a `vscodeKey` (LS-only keys such as `token`).
 * - Skips keys already present in the tracker (idempotent across activations).
 * - Skips when `inspectConfiguration` returns `undefined` or `globalValue` is `undefined`.
 * - When `defaultValue` is `undefined` (the setting has no package.json `default:` —
 *   e.g. organization, customEndpoint, cliPath, additionalParameters), a defined
 *   `globalValue` is treated as an explicit change and seeded.
 * - Uses lodash `isEqual` for deep equality to compare `globalValue` with `defaultValue`.
 */
export function seedExplicitChangesFromExistingSettings(
  tracker: IExplicitLspConfigurationChangeTracker,
  workspace: Pick<IVSCodeWorkspace, 'inspectConfiguration'>,
): void {
  for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
    // R3: skip alwaysChanged
    if (entry.alwaysChanged) continue;
    // R2: skip entries without a VS Code key
    if (!entry.vscodeKey) continue;
    // R5: idempotent — already tracked by this or a previous activation
    if (tracker.isExplicitlyChanged(lsKey)) continue;

    const { configurationId, section } = Configuration.getConfigName(entry.vscodeKey);
    const inspect = workspace.inspectConfiguration(configurationId, section);

    // R4: only seed when globalValue is defined and differs from the default (which may be undefined)
    if (inspect === undefined || inspect.globalValue === undefined) continue;
    if (!isEqual(inspect.globalValue, inspect.defaultValue)) {
      tracker.markExplicitlyChanged(lsKey);
    }
  }
}

/**
 * After a pull response sends a reset (`{ value: null, changed: true }`), unmark the
 * key so future pulls don't permanently re-send `changed: true`.
 *
 * CLAIM 2 analysis (IDE-2149): This function unmarks ANY key with `{value:null, changed:true}`,
 * not just keys that are members of GLOBAL_RESET_FIELDS.  A concern was raised that a non-reset
 * key whose resolver returns `null` could be wrongly unmarked here.
 *
 * Investigation result — NOT REACHABLE: No `SETTINGS_REGISTRY` entry's `resolve()` ever
 * returns `null` for an explicitly-changeable key.  Confirmed by inspecting every resolver
 * in `lsKeyToVscodeKeyMap.ts`:
 *   - Boolean resolvers use `?? true` fallbacks (never null).
 *   - `riskScoreThreshold` uses `?? undefined`, so `null ?? undefined === undefined`.
 *   - String resolvers return typed strings or undefined (e.g. `getToken()` returns
 *     `Promise<string | undefined>`, `organization` getter returns `string`).
 *   - `scanAutomatic` returns boolean or `undefined`, never null.
 *   - `issueViewOptions?.openIssues` / `ignoredIssues` are accessed via optional chain on a
 *     getter that falls back to `DEFAULT_ISSUE_VIEW_OPTIONS`, returning boolean or undefined.
 *   - The only `null` values in outbound settings are pending-reset entries emitted by
 *     `LanguageServerSettings.fromConfiguration` when `isPendingReset(lsKey)` is true.
 *
 * Therefore the only `{value:null, changed:true}` entries in the pull response are genuine
 * pending-reset keys.  This function correctly unmarks only those keys and the "too broad"
 * concern is not reachable in the current codebase.  If a resolver is ever changed to return
 * `null` for a non-reset key, this function would need to be scoped to `GLOBAL_RESET_FIELDS`.
 */
export function unmarkResetLsKeysAfterPull(
  settings: Record<string, LspConfigSetting>,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  for (const [key, entry] of Object.entries(settings)) {
    if (entry.value === null && entry.changed === true) {
      tracker.unmarkExplicitlyChanged(key);
    }
  }
}
