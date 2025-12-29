// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { ILog } from '../../../logger/interfaces';
import { ILanguageClientAdapter } from '../../../vscode/languageClient';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import { IdeConfigData } from '../types/workspaceConfiguration.types';
import { IConfigurationMappingService } from './ConfigurationMappingService';
import { IScopeDetectionService } from './ScopeDetectionService';
import {
  ADVANCED_CLI_PATH,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_RELEASE_CHANNEL,
} from '../../../constants/settings';

const CLI_ONLY_SETTINGS = [
  ADVANCED_CLI_PATH,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_RELEASE_CHANNEL,
  'http.proxyStrictSSL',
];

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
      const config = JSON.parse(configJson) as IdeConfigData & {
        isFallbackForm?: boolean;
      };
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

  private async saveConfigToVSCodeSettings(config: IdeConfigData, isCliOnly: boolean): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = this.configMappingService.mapConfigToSettings(config, isCliOnly);

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
