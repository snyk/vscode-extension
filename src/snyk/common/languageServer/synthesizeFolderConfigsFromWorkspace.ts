import { FolderConfig, type IConfiguration } from '../configuration/configuration';
import type { WorkspaceFolder } from '../vscode/types';

/** Minimal per-folder rows when `getFolderConfigs()` is empty but the workspace has folders (aligned with mergeOrgSettingsIntoLSFolderConfig). */
export function synthesizeFolderConfigsFromWorkspace(
  configuration: IConfiguration,
  workspaceFolders: readonly WorkspaceFolder[],
): FolderConfig[] {
  return workspaceFolders.map(wf => {
    const fc = new FolderConfig(wf.uri.fsPath);
    const orgSetByUser = !configuration.isAutoSelectOrganizationEnabled(wf);
    fc.setOrgSetByUser(orgSetByUser);
    if (orgSetByUser) {
      fc.setPreferredOrg(configuration.getOrganizationAtWorkspaceFolderLevel(wf) ?? '');
    } else {
      fc.setAutoDeterminedOrg(configuration.getOrganization(wf) ?? '');
    }
    return fc;
  });
}
