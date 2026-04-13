import { FolderConfig, IConfiguration } from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import type { LspConfigurationParam, LspConfigSetting } from './types';
import { SETTINGS_REGISTRY } from './lsKeyToVscodeKeyMap';
import { ExplicitChangePredicate, folderConfigToLspFolderConfiguration } from './serverSettingsToLspConfigurationParam';

export class LanguageServerSettings {
  static resolveFolderConfigs(
    configuration: IConfiguration,
    workspace?: Pick<IVSCodeWorkspace, 'getWorkspaceFolders'>,
  ) {
    let folderConfigs = configuration.getFolderConfigs();
    const wsFolders = workspace?.getWorkspaceFolders?.();
    if (folderConfigs.length === 0 && wsFolders?.length) {
      folderConfigs = wsFolders.map(wf => new FolderConfig(wf.uri.fsPath));
    }
    return folderConfigs;
  }

  static async fromConfiguration(
    configuration: IConfiguration,
    isExplicitlyChanged: ExplicitChangePredicate,
    workspace?: Pick<IVSCodeWorkspace, 'getWorkspaceFolders'>,
  ): Promise<LspConfigurationParam> {
    const m: Record<string, LspConfigSetting> = {};

    for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
      if (entry.alwaysChanged) {
        m[lsKey] = { value: await Promise.resolve(entry.resolve(configuration)), changed: true };
        continue;
      }

      const value = await Promise.resolve(entry.resolve(configuration));
      if (value != null && (typeof value !== 'string' || value.trim() !== '')) {
        m[lsKey] = { value, changed: isExplicitlyChanged(lsKey) };
      } else if (isExplicitlyChanged(lsKey)) {
        m[lsKey] = { value: null, changed: true };
      }
    }

    // Folder configs
    const folderConfigs = LanguageServerSettings.resolveFolderConfigs(configuration, workspace);
    const lspFolderConfigs = folderConfigs.length
      ? folderConfigs.map(fc => folderConfigToLspFolderConfiguration(fc))
      : undefined;

    const result: LspConfigurationParam = { settings: m };
    if (lspFolderConfigs !== undefined) {
      result.folderConfigs = lspFolderConfigs;
    }
    return result;
  }
}
