import type { FolderConfig, IConfiguration } from '../configuration/configuration';
import type { WorkspaceFolder } from '../vscode/types';

/** Minimal per-folder rows when `getFolderConfigs()` is empty but the workspace has folders (aligned with mergeOrgSettingsIntoLSFolderConfig). */
export function synthesizeFolderConfigsFromWorkspace(
  configuration: IConfiguration,
  workspaceFolders: readonly WorkspaceFolder[],
): FolderConfig[] {
  return workspaceFolders.map(wf => {
    const orgSetByUser = !configuration.isAutoSelectOrganizationEnabled(wf);
    const common = {
      folderPath: wf.uri.fsPath,
      baseBranch: '',
      localBranches: undefined,
      referenceFolderPath: undefined,
      orgMigratedFromGlobalConfig: false,
    };
    if (orgSetByUser) {
      return {
        ...common,
        orgSetByUser: true,
        preferredOrg: configuration.getOrganizationAtWorkspaceFolderLevel(wf) ?? '',
        autoDeterminedOrg: '',
      };
    }
    return {
      ...common,
      orgSetByUser: false,
      preferredOrg: '',
      autoDeterminedOrg: configuration.getOrganization(wf) ?? '',
    };
  });
}
