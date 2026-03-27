import { LspConfigSetting, LspConfigurationParam } from './types';

/**
 * Normalized view of an inbound `$/snyk.configuration` payload only (no VS Code settings,
 * memento, or disk). `globalSettings` is the notification’s top-level `settings` map;
 * `folderSettingsByPath[path]` is global keys shallow-merged with that folder’s `settings`
 * from the same notification.
 */
export type MergedLspConfigurationView = {
  globalSettings: Record<string, LspConfigSetting>;
  folderSettingsByPath: Record<string, Record<string, LspConfigSetting>>;
};

/**
 * Transform of a single `$/snyk.configuration` payload from the language server.
 *
 * - `globalSettings`: copy of `param.settings`.
 * - For each `folderConfigs` entry: `folderSettingsByPath[folderPath] = { ...globalSettings, ...folderSpecific }`
 *   so folder keys override the same keys from the global map for that path only.
 * - Duplicate `folderPath` values in `folderConfigs`: last entry wins.
 */
export function mergeInboundLspConfiguration(param: LspConfigurationParam): MergedLspConfigurationView {
  const globalSettings: Record<string, LspConfigSetting> = { ...(param.settings ?? {}) };
  const folderSettingsByPath: Record<string, Record<string, LspConfigSetting>> = {};

  for (const fc of param.folderConfigs ?? []) {
    const folderSpecific = fc.settings ?? {};
    folderSettingsByPath[fc.folderPath] = { ...globalSettings, ...folderSpecific };
  }

  return { globalSettings, folderSettingsByPath };
}
