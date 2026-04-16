// ABOUTME: Service for persisting configuration to VS Code settings and secret storage
// ABOUTME: Handles token storage and workspace/user-level settings updates
import { IConfiguration } from '../../../configuration/configuration';
import { Configuration } from '../../../configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../constants/languageServer';
import { SNYK_CONTEXT } from '../../../constants/views';
import { ILog } from '../../../logger/interfaces';
import { IContextService } from '../../../services/contextService';
import { ILanguageClientAdapter } from '../../../vscode/languageClient';
import { IVSCodeWorkspace } from '../../../vscode/workspace';
import type { LspConfigurationParam } from '../../../languageServer/types';
import { folderConfigsFromLspParam } from '../../../languageServer/inboundLspFolderSettingsToFolderConfig';
import { mapConfigToSettings, mapLspSettingsToVscodeSettings } from '../../../languageServer/lsKeyToVscodeKeyMap';
import { HtmlSettingsData, HtmlFolderSettingsData } from '../types/workspaceConfiguration.types';
import { IScopeDetectionService } from './scopeDetectionService';

export interface IConfigurationPersistenceService {
  handleSaveConfig(configJson: string): Promise<void>;

  /**
   * Writes LS global settings from `$/snyk.configuration` into VS Code `settings.json`.
   * No-op when the global snapshot has no mappable keys.
   */
  persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void>;
}

export class ConfigurationPersistenceService implements IConfigurationPersistenceService {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly scopeDetectionService: IScopeDetectionService,
    private readonly clientAdapter: ILanguageClientAdapter,
    private readonly logger: ILog,
    private readonly contextService?: IContextService,
  ) {}

  async handleSaveConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as HtmlSettingsData;
      const isCliOnly = config.isFallbackForm ?? false;
      this.logger.info(`Saving workspace configuration (CLI only: ${isCliOnly})`);

      await this.saveConfigToVSCodeSettings(config, isCliOnly);

      // Only handle token when not in CLI-only mode and token is present in the payload
      if (!isCliOnly && 'token' in config) {
        const existingToken = await this.configuration.getToken();
        const normalizedNewToken = config.token?.trim() || '';
        const normalizedExistingToken = existingToken?.trim() || '';
        if (normalizedNewToken !== normalizedExistingToken) {
          await this.configuration.setToken(config.token);
          if (this.contextService) {
            await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
            await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATION_METHOD_CHANGED, false);
          }
        }
      }

      // Notify the LS once after all settings (including token) have been written
      await this.clientAdapter.getLanguageClient().sendNotification(DID_CHANGE_CONFIGURATION_METHOD, {});

      this.logger.info('Workspace configuration saved successfully');
    } catch (e) {
      this.logger.error(`Failed to save workspace configuration: ${e}`);
      throw e;
    }
  }

  async persistInboundLspConfiguration(param: LspConfigurationParam): Promise<void> {
    try {
      // Map LS settings directly to VS Code settings using the registry.
      // Entries without a vscodeKey (token, sendErrorReports, etc.) are skipped automatically.
      const settingsMap = mapLspSettingsToVscodeSettings(param.settings ?? {});

      if (Object.keys(settingsMap).length > 0) {
        this.logger.debug('Persisting inbound Snyk Language Server configuration to VS Code settings');
        await this.applySettingsMap(settingsMap);
      }

      // Apply folder configs to in-memory storage — LS is the source of truth.
      // An empty array means "clear all folder overrides".
      if (param.folderConfigs !== undefined) {
        await this.configuration.setFolderConfigs(folderConfigsFromLspParam(param));
      }
    } catch (e) {
      this.logger.error(`Failed to persist inbound LS configuration: ${e}`);
      throw e;
    }
  }

  private async applySettingsMap(settingsMap: Record<string, unknown>): Promise<void> {
    for (const [settingKey, value] of Object.entries(settingsMap)) {
      try {
        const { configurationId, section: settingName } = Configuration.getConfigName(settingKey);

        const scope = this.scopeDetectionService.getSettingScope(settingKey);

        // For object values, merge with current VS Code value to preserve sibling keys
        let effectiveValue = value;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const current = this.workspace.getConfiguration(configurationId, settingName);
          if (current && typeof current === 'object') {
            effectiveValue = { ...(current as Record<string, unknown>), ...(value as Record<string, unknown>) };
          }
        }

        if (this.scopeDetectionService.shouldSkipSettingUpdate(configurationId, settingName, effectiveValue, scope)) {
          this.logger.debug(`Skipping ${settingKey}: no change or value is at default and not explicitly set`);
          continue;
        }

        await this.workspace.updateConfiguration(configurationId, settingName, effectiveValue, scope !== 'workspace');

        this.logger.debug(`Updated setting: ${settingKey} at ${scope} level`);
      } catch (e) {
        this.logger.error(`Failed to update setting ${settingKey}: ${e}`);
      }
    }

    this.logger.info('Successfully applied settings map to VS Code configuration');
  }

  private async saveFolderConfigs(folderConfigs?: Array<HtmlFolderSettingsData>): Promise<void> {
    if (!folderConfigs) return;

    const currentFolderConfigs = this.configuration.getFolderConfigs();

    const folderConfigMap = new Map(folderConfigs.map(fc => [fc.folderPath, fc]));

    const updatedFolderConfigs = currentFolderConfigs.map(currentFolderConfig => {
      const formData = folderConfigMap.get(currentFolderConfig.folderPath);
      if (!formData) return currentFolderConfig;

      // HtmlFolderSettingsData field names ARE LS key strings (snake_case),
      // so they pass directly to FolderConfig.setSetting().
      for (const [key, value] of Object.entries(formData)) {
        if (key === 'folderPath' || value === undefined) continue;
        currentFolderConfig.setSetting(key, value);
      }

      return currentFolderConfig;
    });

    await this.configuration.setFolderConfigs(updatedFolderConfigs, false);
  }

  private async saveConfigToVSCodeSettings(config: HtmlSettingsData, isCliOnly: boolean): Promise<void> {
    this.logger.info('Writing configuration to VS Code settings');

    const settingsMap = mapConfigToSettings(config, isCliOnly);

    if (!isCliOnly) await this.saveFolderConfigs(config.folderConfigs);

    await this.applySettingsMap(settingsMap);

    this.logger.info('Successfully wrote all settings to VS Code configuration');
  }
}
