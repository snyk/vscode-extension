// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { ADVANCED_ORGANIZATION, ADVANCED_AUTO_SELECT_ORGANIZATION } from '../../../constants/settings';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { ILog } from '../../../logger/interfaces';
import { ILanguageClientAdapter } from '../../../vscode/languageClient';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import { IdeConfigData, FolderConfigData } from '../types/workspaceConfiguration.types';
import { IConfigurationMappingService } from './configurationMappingService';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly configMappingService: IConfigurationMappingService,
    private readonly clientAdapter: ILanguageClientAdapter,
    private readonly logger: ILog,
  ) {}

  async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as IdeConfigData;
      const isCliOnly = config.isFallbackForm ?? false;
      this.logger.info(`Saving workspace configuration (CLI only: ${isCliOnly})`);

      await this.saveConfigToVSCodeSettings(config, isCliOnly);

      // Only handle token when not in CLI-only mode
      if (!isCliOnly) {
        // Persist token to secret storage only if it has changed
        const existingToken = await this.configuration.getToken();
        // Normalize empty/null/undefined to empty string for comparison
        const normalizedNewToken = config.token?.trim() || '';
        const normalizedExistingToken = existingToken?.trim() || '';
        if (normalizedNewToken !== normalizedExistingToken) {
          await this.configuration.setToken(config.token);
          await this.clientAdapter.getLanguageClient().sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});
        }
      }

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  private async extractAndSaveFolderLevelOrgSettings(folderConfigs: Array<FolderConfigData>): Promise<void> {
    const workspaceFolders = this.workspace.getWorkspaceFolders();

    const updates = folderConfigs.map(async (config): Promise<void> => {
      const folderPath = config.folderPath;

      if (!folderPath) return;

      const workspaceFolder = workspaceFolders.find(f => f.uri.fsPath === folderPath);
      if (!workspaceFolder) {
        this.logger.warn(`No workspace folder found for path: ${folderPath}`);
        return;
      }

      // Determine which org to display
      const orgToDisplay = config.orgSetByUser ? config.preferredOrg : config.autoDeterminedOrg;

      // Save organization at folder level
      if (orgToDisplay !== undefined) {
        const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);

        // Skip if value is default and not explicitly set
        if (
          !this.scopeDetectionService.isSettingsWithDefaultValue(
            configurationId,
            section,
            orgToDisplay,
            workspaceFolder,
          )
        ) {
          await this.workspace.updateConfiguration(configurationId, section, orgToDisplay, workspaceFolder);
          this.logger.debug(`Set organization "${orgToDisplay}" for workspace folder: ${folderPath}`);
        } else {
          this.logger.debug(`Skipping organization for ${folderPath}: value is at default and not explicitly set`);
        }
      }

      if (config.orgSetByUser !== undefined) {
        const autoSelectOrg = !config.orgSetByUser;
        const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTO_SELECT_ORGANIZATION);

        if (
          !this.scopeDetectionService.isSettingsWithDefaultValue(
            configurationId,
            section,
            autoSelectOrg,
            workspaceFolder,
          )
        ) {
          await this.workspace.updateConfiguration(configurationId, section, autoSelectOrg, workspaceFolder);
          this.logger.debug(`Set auto-select organization to ${autoSelectOrg} for workspace folder: ${folderPath}`);
        } else {
          this.logger.debug(`Skipping auto-select org for ${folderPath}: value is at default and not explicitly set`);
        }
      }
    });

    await Promise.all(updates);
  }

  private async saveConfigToVSCodeSettings(config: IdeConfigData, isCliOnly: boolean): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.configMappingService.mapConfigToSettings(config, isCliOnly);

    // Special handling: Extract organization settings from folder configs and save at folder level
    if (!isCliOnly && config.folderConfigs) {
      await this.extractAndSaveFolderLevelOrgSettings(config.folderConfigs);
    }

    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        const scope = this.scopeDetectionService.getSettingScope(settingKey);

        if (this.scopeDetectionService.isSettingsWithDefaultValue(configurationId, settingName, value)) {
          this.logger.debug(`Skipping ${settingKey}: value is at default and not explicitly set`);
          return;
        }

        await this.workspace.updateConfiguration(configurationId, settingName, value, scope !== 'workspace');

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    });

    await Promise.all(updates);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
