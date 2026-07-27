import type { ConfigurationChangeEvent } from '../vscode/types';
import { SETTINGS_REGISTRY, VSCODE_KEY_TO_LS_KEYS } from './lsKeyToVscodeKeyMap';
import type { IExplicitOverridesMap } from './explicitOverridesMap';
import type { ILastKnownValueCache } from './lastKnownValueCache';
import type { LspConfigSetting } from './types';
import type { ILog } from '../logger/interfaces';
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
 * The throw is logged rather than silently swallowed, since it means a registered fan-out
 * entry's resolver reads a field the stub above doesn't provide — a bug worth surfacing, not a
 * routine "no change" outcome.
 */
function projectFanOutSubValue(lsKey: string, rawVscodeValue: unknown, logger?: Pick<ILog, 'error'>): unknown {
  const entry = SETTINGS_REGISTRY[lsKey as keyof typeof SETTINGS_REGISTRY];
  const stub = {
    severityFilter: (rawVscodeValue as typeof DEFAULT_SEVERITY_FILTER) ?? DEFAULT_SEVERITY_FILTER,
    issueViewOptions: (rawVscodeValue as typeof DEFAULT_ISSUE_VIEW_OPTIONS) ?? DEFAULT_ISSUE_VIEW_OPTIONS,
  } as unknown as IConfiguration;
  try {
    return entry.resolve(stub);
  } catch (error) {
    logger?.error(`Fan-out resolver for LS key "${lsKey}" threw while projecting its sub-value: ${String(error)}`);
    return undefined;
  }
}

/**
 * Returns the current LS-shaped value for a single-LS-key VS Code setting, via the registry's
 * own `resolve`. Awaiting works uniformly whether `resolve` is sync or returns a Promise (e.g.
 * cliPath) — the explicit-overrides map stores this value directly as the outbound LS value, so
 * an async resolver's real result must not be discarded.
 *
 * A throwing resolver is logged rather than silently swallowed, since the caller stores
 * `undefined` as the explicit override in that case — worth surfacing, not a routine outcome.
 */
async function resolveCurrentLsValue(
  lsKey: string,
  configuration: IConfiguration,
  logger?: Pick<ILog, 'error'>,
): Promise<unknown> {
  const entry = SETTINGS_REGISTRY[lsKey as keyof typeof SETTINGS_REGISTRY];
  try {
    return await entry.resolve(configuration);
  } catch (error) {
    logger?.error(`Resolver for LS key "${lsKey}" threw while reading its current value: ${String(error)}`);
    return undefined;
  }
}

/**
 * True iff `vscodeKey`'s current VS Code value equals the last-known-value cache entry — i.e.
 * the pending change reflects a write the extension itself already made, not a genuine external
 * edit. Stateless, so independent call sites (this file's marker, the middleware's echo
 * suppression) can run the same comparison without sharing a per-event flag.
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
 * Backs the middleware's outbound echo-suppression decision: true iff any tracked VS Code key
 * currently diverges from the last-known-value cache (a genuine change not yet reflected).
 * Agrees with {@link markExplicitLsKeysFromConfigurationChangeEvent} for the same event
 * regardless of which of the two `onDidChangeConfiguration` listeners VS Code invokes first —
 * that function defers its own cache mutation to a microtask so this check never observes a
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
 * shared last-known-value cache: a VS Code key whose current value matches the
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
  logger?: Pick<ILog, 'error'>,
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

    // Deferred to a microtask, not applied immediately: VS Code invokes every listener for this
    // one event synchronously and back-to-back (including the language client's own listener
    // behind hasUnreflectedConfigurationChange), so mutating now could make that independent
    // check's outcome depend on listener registration order. Deferring guarantees every listener
    // for THIS event observes the pre-mutation value.
    queueMicrotask(() => lastKnownValueCache.set(vscodeKey, newValue));

    if (lsKeys.length === 1) {
      // VS Code only fires the event when the value actually changed, and the whole-value
      // compare above already confirmed that — mark unconditionally.
      explicitOverrides.setExplicitValue(lsKeys[0], await resolveCurrentLsValue(lsKeys[0], configuration, logger));
      continue;
    }

    // Fan-out: multiple LS keys share one VS Code setting. Mark only the siblings whose own
    // projected sub-value actually changed, not every sibling sharing the VS Code key.
    for (const lsKey of lsKeys) {
      const oldProjected = projectFanOutSubValue(lsKey, oldValue, logger);
      const newProjected = projectFanOutSubValue(lsKey, newValue, logger);
      if (isEqual(oldProjected, newProjected)) {
        continue;
      }
      explicitOverrides.setExplicitValue(lsKey, newProjected);
    }
  }
}

/**
 * Seeds the explicit-overrides map with LS keys whose VS Code global setting value differs
 * from the registered default. Call once at activation so that pre-existing user
 * customisations are honoured on the first `workspace/didChangeConfiguration` even if the user
 * has never saved the settings form in the current session.
 *
 * Rules:
 * - Skips `alwaysChanged` entries — they are always emitted with `changed: true`.
 * - Skips entries without a `vscodeKey` (LS-only keys such as `token`).
 * - Skips keys already present in the map (idempotent across activations).
 * - Skips when `inspectConfiguration` returns `undefined` or `globalValue` is `undefined`.
 * - When `defaultValue` is `undefined` (the setting has no package.json `default:` —
 *   e.g. organization, cliPath, additionalParameters), a defined `globalValue` is treated as an
 *   explicit change and seeded.
 * - Uses lodash `isEqual` for deep equality to compare `globalValue` with `defaultValue`.
 */
export function seedExplicitChangesFromExistingSettings(
  explicitOverrides: IExplicitOverridesMap,
  workspace: Pick<IVSCodeWorkspace, 'inspectConfiguration'>,
  logger?: Pick<ILog, 'error'>,
): void {
  for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
    // R3: skip alwaysChanged
    if (entry.alwaysChanged) continue;
    // R2: skip entries without a VS Code key
    if (!entry.vscodeKey) continue;
    // R5: idempotent — already recorded by this or a previous activation
    if (explicitOverrides.getEntry(lsKey) !== undefined) continue;

    const { configurationId, section } = Configuration.getConfigName(entry.vscodeKey);
    const inspect = workspace.inspectConfiguration(configurationId, section);

    // R4: only seed when globalValue is defined and differs from the default (which may be undefined)
    if (inspect === undefined || inspect.globalValue === undefined) continue;

    // Fan-out: several LS keys share one vscodeKey (severity filters, issue view options).
    // inspect.globalValue/defaultValue are the WHOLE shared object for every sibling, so
    // comparing them directly would seed every sibling whenever any one of them deviates from
    // default. Project each sibling's own sub-value first (same projection the config-change
    // path uses) and seed only the sibling whose own value actually differs.
    const isFanOut = (VSCODE_KEY_TO_LS_KEYS[entry.vscodeKey]?.length ?? 0) > 1;
    if (!isFanOut) {
      if (!isEqual(inspect.globalValue, inspect.defaultValue)) {
        explicitOverrides.setExplicitValue(lsKey, inspect.globalValue);
      }
      continue;
    }

    const projectedGlobal = projectFanOutSubValue(lsKey, inspect.globalValue, logger);
    const projectedDefault = projectFanOutSubValue(lsKey, inspect.defaultValue, logger);
    if (!isEqual(projectedGlobal, projectedDefault)) {
      explicitOverrides.setExplicitValue(lsKey, projectedGlobal);
    }
  }
}

/**
 * The sole `changed` predicate for `LanguageServerSettings.fromConfiguration`
 * — both `'value'` and `'reset'` entries count as explicitly changed. Shared by every
 * `fromConfiguration` call site (`middleware.ts`, `languageServer.ts`) so the read-side definition
 * of "changed" can't drift between them.
 */
export function isExplicitlyChanged(lsKey: string, explicitOverrides: IExplicitOverridesMap): boolean {
  return explicitOverrides.getEntry(lsKey) !== undefined;
}

/** Companion to {@link isExplicitlyChanged}: true only for a queued reset sentinel. */
export function isPendingReset(lsKey: string, explicitOverrides: IExplicitOverridesMap): boolean {
  return explicitOverrides.getEntry(lsKey)?.kind === 'reset';
}

/**
 * Shared by every constructor (`LanguageServer`, `LanguageClientMiddleware`,
 * `ConfigurationPersistenceService`) that requires both explicit-override-tracking deps.
 */
export function assertExplicitOverrideDepsPresent(
  className: string,
  explicitOverrides: IExplicitOverridesMap | undefined,
  lastKnownValueCache: ILastKnownValueCache | undefined,
): void {
  if (!explicitOverrides || !lastKnownValueCache) {
    throw new Error(
      `${className} requires explicitOverridesMap and lastKnownValueCache to track explicit LS-key overrides`,
    );
  }
}

/**
 * After a pull response sends a reset (`{ value: null, changed: true }`),
 * confirms delivery in the explicit-overrides map so the sentinel is cleared and not resent on a
 * later pull. Only called with the settings that actually made it into a successfully built
 * response — the map is never drained before that point, so a build failure automatically leaves
 * every entry intact for retry (see the `isPendingReset` predicate at each `fromConfiguration`
 * call site, which reads the map live rather than a pre-drained snapshot).
 */
export function confirmResetsDeliveredAfterPull(
  settings: Record<string, LspConfigSetting>,
  explicitOverrides: IExplicitOverridesMap,
): void {
  for (const [key, entry] of Object.entries(settings)) {
    if (entry.value === null && entry.changed === true) {
      explicitOverrides.confirmResetDelivered(key);
    }
  }
}
