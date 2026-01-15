// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { ADVANCED_ORGANIZATION } from '../../../constants/settings';
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

  /**
   * Special handling for folder configs, write in-memory and send to language-server
   * and then folder notification handler will persist it (standard flow for folder configs)
   */
  private async saveFolderConfigs(folderConfigs?: Array<FolderConfigData>): Promise<void> {
    if (!folderConfigs) return;

    const currentFolderConfigs = this.configuration.getFolderConfigs();

    const folderConfigMap = new Map(folderConfigs.map(fc => [fc.folderPath, fc]));

    const updatedFolderConfigs = currentFolderConfigs.map(currentFolderConfig => {
      const folderConfig = folderConfigMap.get(currentFolderConfig.folderPath);
      if (!folderConfig) return currentFolderConfig;

      return {
        ...currentFolderConfig,
        ...folderConfig,
      };
    });

    await this.configuration.setFolderConfigs(updatedFolderConfigs, true);
  }

  private async saveConfigToVSCodeSettings(config: IdeConfigData, isCliOnly: boolean): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.configMappingService.mapConfigToSettings(config, isCliOnly);

    if (!isCliOnly) await this.saveFolderConfigs(config.folderConfigs);

    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        if (settingKey === ADVANCED_ORGANIZATION) {
          // Special handling for global org
          const workspaceFolders = this.workspace.getWorkspaceFolders();
          const isSingleFolderWorkspace = workspaceFolders.length === 1;
          const inspection = this.workspace.inspectConfiguration<string>(configurationId, settingName);
          const hasBeenModifiedOnWorkspaceLevel = inspection?.workspaceValue !== undefined;
          const writeToUserScope = isSingleFolderWorkspace || !hasBeenModifiedOnWorkspaceLevel;
          await this.workspace.updateConfiguration(configurationId, settingName, value, writeToUserScope);
          this.logger.debug(`Updated setting: ${settingKey} at ${writeToUserScope ? 'user' : 'workspace'} level`);
        } else {
          const scope = this.scopeDetectionService.getSettingScope(settingKey);

          if (this.scopeDetectionService.shouldSkipSettingUpdate(configurationId, settingName, value, scope)) {
            this.logger.debug(`Skipping ${settingKey}: no change or value is at default and not explicitly set`);
            return;
          }

          await this.workspace.updateConfiguration(configurationId, settingName, value, scope !== 'workspace');

          this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
        }
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    });

    await Promise.all(updates);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
