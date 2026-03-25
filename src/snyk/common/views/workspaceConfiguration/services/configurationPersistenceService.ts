// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { ADVANCED_ORGANIZATION } from '../../../constants/settings';
import type { IExplicitLspConfigurationChangeTracker } from '../../../languageServer/explicitLspConfigurationChangeTracker';
import { ILog } from '../../../logger/interfaces';
import { ILanguageClientAdapter } from '../../../vscode/languageClient';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import type { MergedLspConfigurationView } from '../../../languageServer/lspConfigurationMerge';
import { mergedGlobalSettingsToIdeConfigData } from '../../../languageServer/inboundLspConfigurationToIdeConfig';
import { IdeConfigData, FolderConfigData } from '../types/workspaceConfiguration.types';
import { IConfigurationMappingService } from './configurationMappingService';
import { markExplicitPflagsFromIdeConfigDiff } from './ideConfigExplicitPflags';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;

  /**
   * Writes effective LS global settings from each merged `$/snyk.configuration` into VS Code
   * `settings.json` (and token into secret storage). No-op when the global snapshot has no mappable keys.
   */
  persistInboundLspConfiguration(view: MergedLspConfigurationView): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly configMappingService: IConfigurationMappingService,
    private readonly clientAdapter: ILanguageClientAdapter,
    private readonly explicitLspConfigurationChangeTracker: IExplicitLspConfigurationChangeTracker,
    private readonly logger: ILog,
  ) {}

  async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as IdeConfigData;
      const isCliOnly = config.isFallbackForm ?? false;
      this.logger.info(`Saving workspace configuration (CLI only: ${isCliOnly})`);

      await markExplicitPflagsFromIdeConfigDiff(
        config,
        this.configuration,
        this.explicitLspConfigurationChangeTracker,
        isCliOnly,
      );

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

  async persistInboundLspConfiguration(view: MergedLspConfigurationView): Promise<void> {
    const partial = mergedGlobalSettingsToIdeConfigData(view.globalSettings);
    if (Object.keys(partial).length === 0) {
      return;
    }

    const tokenFromLs = partial.token;
    const { token: _omit, ...rest } = partial;
    const ideForSettings = rest as IdeConfigData;

    const rawMap = this.configMappingService.mapConfigToSettings(ideForSettings, false);
    const settingsMap = Object.fromEntries(Object.entries(rawMap).filter(([, v]) => v !== undefined)) as Record<
      string,
      unknown
    >;

    try {
      if (Object.keys(settingsMap).length > 0) {
        this.logger.debug('Persisting inbound Snyk Language Server configuration to VS Code settings');
        await this.applySettingsMap(settingsMap);
      }

      const trimmed = tokenFromLs?.trim();
      if (trimmed) {
        const existing = await this.configuration.getToken();
        if (existing?.trim() !== trimmed) {
          await this.configuration.setToken(tokenFromLs);
          await this.clientAdapter.getLanguageClient().sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});
        }
      }
    } catch (e) {
      this.logger.error(`Failed to persist inbound LS configuration: ${e}`);
      throw e;
    }
  }

  private async applySettingsMap(settingsMap: Record<string, unknown>): Promise<void> {
    const updates = Object.entries(settingsMap).map(async ([settingKey, value]) => {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        if (settingKey === ADVANCED_ORGANIZATION) {
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
    this.logger.info('Successfully applied settings map to VS Code configuration');
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

    await this.applySettingsMap(settingsMap);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
