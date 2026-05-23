import type { ConfigurationChangeEvent } from '../vscode/types';
import { VSCODE_KEY_TO_LS_KEYS } from './lsKeyToVscodeKeyMap';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import type { LspConfigSetting } from './types';

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
 * After a pull response sends a reset (`{ value: null | '', changed: true }`), unmark
 * the key so future pulls don't permanently re-send `changed: true`. Cleared string
 * settings emit `''` (LS rejects `null` for string-typed settings).
 */
export function unmarkResetLsKeysAfterPull(
  settings: Record<string, LspConfigSetting>,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  for (const [key, entry] of Object.entries(settings)) {
    if (entry.changed === true && (entry.value === null || entry.value === '')) {
      tracker.unmarkExplicitlyChanged(key);
    }
  }
}
