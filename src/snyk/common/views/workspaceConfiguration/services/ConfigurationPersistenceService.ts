// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { ILog } from '../../../logger/interfaces';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import { IdeConfigData } from '../types/workspaceConfiguration.types';
import { IConfigurationMappingService } from './ConfigurationMappingService';
import { IScopeDetectionService } from './ScopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly configMappingService: IConfigurationMappingService,
    private readonly logger: ILog,
  ) {}

  async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as IdeConfigData;
      this.logger.info('Saving workspace configuration');

      // Persist token to secret storage only if it has changed
      const existingToken = await this.configuration.getToken();
      if (config.token !== existingToken) {
        await this.configuration.setToken(config.token);
        this.logger.debug('Token persisted to secret storage');
      }

      await this.saveConfigToVSCodeSettings(config);

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  private async saveConfigToVSCodeSettings(config: IdeConfigData): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.configMappingService.mapConfigToSettings(config);

    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        const scope = this.scopeDetectionService.getSettingScope(settingKey);

        // Skip writing if value is at default and hasn't been explicitly set by user
        if (scope === 'default') {
          const inspection = this.workspace.inspectConfiguration(configurationId, settingName);
          const isDefaultValue = inspection && JSON.stringify(value) === JSON.stringify(inspection.defaultValue);

          if (isDefaultValue) {
            this.logger.debug(`Skipping ${settingKey}: value is at default and not explicitly set`);
            return;
          }
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
