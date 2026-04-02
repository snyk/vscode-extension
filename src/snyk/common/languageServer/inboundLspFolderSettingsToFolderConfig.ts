import type { FolderConfig } from '../configuration/configuration';
import { LS_KEY } from './serverSettingsToLspConfigurationParam';
import type { LspConfigSetting, LspConfigurationParam } from './types';

function getValue<T>(s: LspConfigSetting | undefined): T | undefined {
  if (!s || s.value === undefined) {
    return undefined;
  }
  return s.value as T;
}

/**
 * Maps LS `settings` for one folder into a {@link FolderConfig}.
 * LS is the source of truth — values come directly from the LS payload.
 */
function folderConfigFromLspSettings(folderPath: string, settings: Record<string, LspConfigSetting>): FolderConfig {
  return {
    folderPath,
    baseBranch: getValue<string>(settings[LS_KEY.baseBranch]) ?? '',
    localBranches: getValue<string[]>(settings[LS_KEY.localBranches]),
    referenceFolderPath: getValue<string>(settings[LS_KEY.referenceFolder]),
    orgSetByUser: getValue<boolean>(settings[LS_KEY.orgSetByUser]) ?? false,
    preferredOrg: getValue<string>(settings[LS_KEY.preferredOrg]) ?? '',
    autoDeterminedOrg: getValue<string>(settings[LS_KEY.autoDeterminedOrg]) ?? '',
    orgMigratedFromGlobalConfig: false,
    scanCommandConfig: getValue<FolderConfig['scanCommandConfig']>(settings[LS_KEY.scanCommandConfig]),
    sastSettings: getValue<FolderConfig['sastSettings']>(settings[LS_KEY.sastSettings]),
  };
}

/**
 * Converts inbound `$/snyk.configuration` folder rows into {@link FolderConfig} list.
 * LS is the source of truth — the returned list replaces in-memory state entirely.
 */
export function folderConfigsFromLspParam(param: LspConfigurationParam): FolderConfig[] {
  const incoming = param.folderConfigs;
  if (!incoming || incoming.length === 0) {
    return [];
  }

  return incoming.map(fc => folderConfigFromLspSettings(fc.folderPath, fc.settings ?? {}));
}
