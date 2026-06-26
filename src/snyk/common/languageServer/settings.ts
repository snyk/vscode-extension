import { FolderConfig, IConfiguration } from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import type { LspConfigurationParam, LspConfigSetting } from './types';
import { SETTINGS_REGISTRY } from './lsKeyToVscodeKeyMap';
import { ExplicitChangePredicate, folderConfigToLspFolderConfiguration } from './serverSettingsToLspConfigurationParam';

/** Returns true when the LS key has a pending outbound reset (emit `{value:null, changed:true}`). */
type PendingResetPredicate = (lsKey: string) => boolean;

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
    isPendingReset?: PendingResetPredicate,
  ): Promise<LspConfigurationParam> {
    const entries = await Promise.all(
      Object.entries(SETTINGS_REGISTRY).map(async ([lsKey, entry]) => {
        // Outbound reset: the dialog saved null for a global-resettable field.
        // Emit { value: null, changed: true } so the LS clears the user:global override.
        if (isPendingReset?.(lsKey)) {
          return [lsKey, { value: null, changed: true }] as const;
        }
        const value = await entry.resolve(configuration);
        return [lsKey, { value, changed: entry.alwaysChanged || isExplicitlyChanged(lsKey) }] as const;
      }),
    );
    const m: Record<string, LspConfigSetting> = Object.fromEntries(entries);

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
