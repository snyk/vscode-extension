import type { FolderConfig } from '../configuration/configuration';
import type { MergedLspConfigurationView } from './lspConfigurationMerge';
import { PFLAG } from './serverSettingsToLspConfigurationParam';
import type { LspConfigSetting } from './types';

function getValue<T>(s: LspConfigSetting | undefined): T | undefined {
  if (!s || s.value === undefined) {
    return undefined;
  }
  return s.value as T;
}

/**
 * Maps LS pflag `settings` for one folder (merged global + folder in
 * {@link mergeInboundLspConfiguration}) into fields of {@link FolderConfig}.
 * Only keys present in the LSP payload are applied; other {@link FolderConfig} fields are left unchanged by the caller merge.
 */
export function folderConfigPatchFromLspFolderSettings(
  settings: Record<string, LspConfigSetting>,
): Partial<FolderConfig> {
  const patch: Partial<FolderConfig> = {};

  const preferredOrg = getValue<string>(settings[PFLAG.preferredOrg]);
  if (preferredOrg !== undefined) {
    patch.preferredOrg = preferredOrg;
  }

  const autoDeterminedOrg = getValue<string>(settings[PFLAG.autoDeterminedOrg]);
  if (autoDeterminedOrg !== undefined) {
    patch.autoDeterminedOrg = autoDeterminedOrg;
  }

  const orgSetByUser = getValue<boolean>(settings[PFLAG.orgSetByUser]);
  if (orgSetByUser !== undefined) {
    patch.orgSetByUser = orgSetByUser;
  }

  const scanCommandConfig = getValue<FolderConfig['scanCommandConfig']>(settings[PFLAG.scanCommandConfig]);
  if (scanCommandConfig !== undefined) {
    patch.scanCommandConfig = scanCommandConfig;
  }

  const baseBranch = getValue<string>(settings[PFLAG.baseBranch]);
  if (baseBranch !== undefined) {
    patch.baseBranch = baseBranch;
  }

  const localBranches = getValue<string[]>(settings[PFLAG.localBranches]);
  if (localBranches !== undefined) {
    patch.localBranches = localBranches;
  }

  const referenceFolder = getValue<string>(settings[PFLAG.referenceFolder]);
  if (referenceFolder !== undefined) {
    patch.referenceFolderPath = referenceFolder;
  }

  const sastSettings = getValue<FolderConfig['sastSettings']>(settings[PFLAG.sastSettings]);
  if (sastSettings !== undefined) {
    patch.sastSettings = sastSettings;
  }

  return patch;
}

function minimalFolderConfig(folderPath: string): FolderConfig {
  return {
    folderPath,
    baseBranch: '',
    localBranches: undefined,
    referenceFolderPath: undefined,
    orgSetByUser: false,
    preferredOrg: '',
    autoDeterminedOrg: '',
    orgMigratedFromGlobalConfig: false,
  };
}

/**
 * Merges inbound `$/snyk.configuration` folder rows into in-memory {@link FolderConfig} list.
 * Preserves existing entries and order; appends new folder paths at the end.
 */
export function mergeFolderConfigsWithInboundLspView(
  existing: FolderConfig[],
  view: MergedLspConfigurationView,
): FolderConfig[] {
  const incomingPaths = Object.keys(view.folderSettingsByPath);
  if (incomingPaths.length === 0) {
    return existing;
  }

  const result: FolderConfig[] = existing.map(fc => ({ ...fc }));

  for (const folderPath of incomingPaths) {
    const settings = view.folderSettingsByPath[folderPath];
    if (!settings) {
      continue;
    }
    const patch = folderConfigPatchFromLspFolderSettings(settings);
    if (Object.keys(patch).length === 0) {
      continue;
    }

    const idx = result.findIndex(fc => fc.folderPath === folderPath);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...patch, folderPath };
    } else {
      result.push({ ...minimalFolderConfig(folderPath), ...patch, folderPath });
    }
  }

  return result;
}
