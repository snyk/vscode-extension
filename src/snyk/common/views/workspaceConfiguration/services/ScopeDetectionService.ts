// ABOUTME: Service for detecting VS Code configuration scope (user/workspace/folder/default)
// ABOUTME: and populating scope indicators in HTML
import { WorkspaceFolder } from 'vscode';
import { Configuration } from '../../../configuration/configuration';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import _ from 'lodash';

export interface IScopeDetectionService {
  getSettingScope(settingKey: string): string;
  populateScopeIndicators(html: string, mapHtmlKeyToVSCodeSetting: (htmlKey: string) => string | undefined): string;
  isSettingsWithDefaultValue(
    configurationId: string,
    settingName: string,
    value: unknown,
    workspaceFolder?: WorkspaceFolder,
  ): boolean;
}

export class ScopeDetectionService implements IScopeDetectionService {
  constructor(private readonly workspace: IVSCodeWorkspace) {}

  getSettingScope(settingKey: string): string {
    const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

    const inspection = this.workspace.inspectConfiguration(configurationId, settingName);

    if (!inspection) return 'default';

    // Priority: workspaceFolderValue > workspaceValue > globalValue
    if (inspection.workspaceFolderValue !== undefined) return 'workspaceFolder';
    if (inspection.workspaceValue !== undefined) return 'workspace';
    if (inspection.globalValue !== undefined) return 'user';
    return 'default';
  }

  populateScopeIndicators(html: string, mapHtmlKeyToVSCodeSetting: (htmlKey: string) => string | undefined): string {
    const slotRegex = /<span[^>]*class="config-scope-slot"[^>]*data-setting-key="([^"]*)"[^>]*><\/span>/g;

    return html.replace(slotRegex, (v, settingKey: string) => {
      const vscodeSetting = mapHtmlKeyToVSCodeSetting(settingKey);
      if (!vscodeSetting) return v;
      const scope = this.getSettingScope(vscodeSetting);

      if (scope !== 'workspace') {
        return v;
      }

      // Create scope indicator text like VS Code does
      return `<span class="config-scope-slot" data-config-scope-slot="true" data-setting-key="${settingKey}">
      <span class="scope-indicator">(Modified in Workspace)</span>
    </span>`;
    });
  }

  isSettingsWithDefaultValue(
    configurationId: string,
    settingName: string,
    value: unknown,
    workspaceFolder?: WorkspaceFolder,
  ): boolean {
    const inspection = this.workspace.inspectConfiguration(configurationId, settingName, workspaceFolder);

    if (!inspection) {
      return false;
    }

    const isDefaultValue = _.isEqual(value, inspection.defaultValue);

    // Only skip if value is at default and hasn't been explicitly set by user at any level
    const hasExplicitValue = workspaceFolder
      ? inspection.workspaceFolderValue !== undefined ||
        inspection.workspaceValue !== undefined ||
        inspection.globalValue !== undefined
      : inspection.workspaceValue !== undefined || inspection.globalValue !== undefined;

    return isDefaultValue && !hasExplicitValue;
  }
}
