// ABOUTME: Service for detecting VS Code configuration scope (user/workspace/folder/default)
// ABOUTME: and populating scope indicators in HTML
import { WorkspaceFolder } from 'vscode';
import { Configuration } from '../../../configuration/configuration';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import { IConfigurationMappingService } from './configurationMappingService';
import _ from 'lodash';

export interface IScopeDetectionService {
  getSettingScope(settingKey: string): string;
  populateScopeIndicators(html: string, configMappingService: IConfigurationMappingService): string;
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

  populateScopeIndicators(html: string, configMappingService: IConfigurationMappingService): string {
    const slotRegex =
      /(?<prefix><span[^>]*class="config-scope-slot"[^>]*data-setting-key=")(?<settingKey>[^"]*)(?<suffix>"[^>]*>)(?<content>.*?)(?<closing><\/span>)/g;

    return html.replace(slotRegex, (match, ...args) => {
      const groups = args[args.length - 1] as {
        prefix: string;
        settingKey: string;
        suffix: string;
        content: string;
        closing: string;
      };

      const vscodeSetting = configMappingService.mapHtmlKeyToVSCodeSetting(groups.settingKey);
      if (!vscodeSetting) return match;
      const scope = this.getSettingScope(vscodeSetting);

      if (scope !== 'workspace') {
        return match;
      }

      // Create scope indicator text like VS Code does - preserve original attributes
      const scopeIndicator = '<span class="scope-indicator">(Modified in Workspace)</span>';
      return `${groups.prefix}${groups.settingKey}${groups.suffix}${scopeIndicator}${groups.closing}`;
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
