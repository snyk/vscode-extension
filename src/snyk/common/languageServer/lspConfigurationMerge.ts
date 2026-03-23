import { LspConfigSetting, LspConfigurationParam } from './types';

/**
 * Normalized view of an inbound `$/snyk.configuration` payload: global keys plus
 * per-folder effective settings (folder-specific keys override global for that path).
 */
export type MergedLspConfigurationView = {
  globalSettings: Record<string, LspConfigSetting>;
  folderSettingsByPath: Record<string, Record<string, LspConfigSetting>>;
};

/**
 * Builds a merged view from the LS notification. For each folder in `folderConfigs`,
 * effective settings are `global` settings overridden by that folder's `settings`.
 * Duplicate `folderPath` entries: last occurrence wins.
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
