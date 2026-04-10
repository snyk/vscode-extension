import type { ConfigurationChangeEvent } from '../vscode/types';
import { vscodeKeyToLsKeys, LS_KEY_TO_VSCODE_KEY } from './lsKeyToVscodeKeyMap';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import type { LspConfigSetting } from './types';

/**
 * When native VS Code configuration changes, mark matching LS keys so outbound
 * `workspace/didChangeConfiguration` sets `ConfigSetting.changed` for user edits.
 *
 * Derives the VS Code → LS key mapping from the unified {@link LS_KEY_TO_VSCODE_KEY} registry.
 */
export function markExplicitLsKeysFromConfigurationChangeEvent(
  e: ConfigurationChangeEvent,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  const seenVscodeKeys = new Set<string>();

  for (const vscodeKey of Object.values(LS_KEY_TO_VSCODE_KEY)) {
    if (seenVscodeKeys.has(vscodeKey)) continue;
    seenVscodeKeys.add(vscodeKey);

    if (e.affectsConfiguration(vscodeKey)) {
      for (const lsKey of vscodeKeyToLsKeys(vscodeKey)) {
        tracker.markExplicitlyChanged(lsKey);
      }
    }
  }
}

/**
 * After a pull response sends a reset (`{ value: null, changed: true }`), unmark the
 * key so future pulls don't permanently re-send `changed: true`.
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
