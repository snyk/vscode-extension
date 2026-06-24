import type { ConfigurationChangeEvent } from '../vscode/types';
import { SETTINGS_REGISTRY, VSCODE_KEY_TO_LS_KEYS } from './lsKeyToVscodeKeyMap';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import type { LspConfigSetting } from './types';
import { Configuration } from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import isEqual from 'lodash/isEqual';

/**
 * When native VS Code configuration changes, mark matching LS keys so outbound
 * `workspace/didChangeConfiguration` sets `ConfigSetting.changed` for user edits.
 *
 * Uses the pre-computed {@link VSCODE_KEY_TO_LS_KEYS} reverse index directly.
 */
export function markExplicitLsKeysFromConfigurationChangeEvent(
  e: ConfigurationChangeEvent,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  for (const [vscodeKey, lsKeys] of Object.entries(VSCODE_KEY_TO_LS_KEYS)) {
    if (e.affectsConfiguration(vscodeKey)) {
      for (const lsKey of lsKeys) {
        tracker.markExplicitlyChanged(lsKey);
      }
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
