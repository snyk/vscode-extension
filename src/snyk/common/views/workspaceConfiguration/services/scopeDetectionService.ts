// ABOUTME: Service for detecting VS Code configuration scope (user/workspace/folder/default)
// ABOUTME: and populating scope indicators in HTML
import { Configuration } from '../../../configuration/configuration';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import { IConfigurationMappingService } from './configurationMappingService';
import _ from 'lodash';

export interface IScopeDetectionService {
  getSettingScope(settingKey: string): string;
  populateScopeIndicators(html: string, configMappingService: IConfigurationMappingService): string;
  /**
   * Determines whether a setting update should be skipped.
   * Returns true if:
   * 1. The new value is the same as the current effective value (no actual change), OR
   * 2. The new value is the default value and hasn't been explicitly set by the user at any level
   */
  shouldSkipSettingUpdate(configurationId: string, settingName: string, value: unknown, scope: string): boolean;
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

  shouldSkipSettingUpdate(configurationId: string, settingName: string, value: unknown, scope: string): boolean {
    const inspection = this.workspace.inspectConfiguration(configurationId, settingName);

    if (!inspection) {
      return false;
    }

    let currentValue: unknown;
    switch (scope) {
      case 'workspace':
        currentValue = inspection.workspaceValue;
        break;
      case 'user':
        currentValue = inspection.globalValue;
        break;
      default:
        return false;
    }

    // Return true if new value is same as current value at this scope (no actual change)
    if (_.isEqual(value, currentValue)) {
      return true;
    }

    const isDefaultValue = _.isEqual(value, inspection.defaultValue);

    // Only skip if value is at default and this specific scope doesn't have an explicit value
    const hasExplicitValue = currentValue !== undefined;

    return isDefaultValue && !hasExplicitValue;
  }
}
