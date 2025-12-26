// ABOUTME: Service for mapping between IdeConfigData and VS Code settings
// ABOUTME: Contains mapping tables and transformation logic for configuration data
import {
  OSS_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  IAC_ENABLED_SETTING,
  SCANNING_MODE,
  ISSUE_VIEW_OPTIONS_SETTING,
  DELTA_FINDINGS,
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_CUSTOM_ENDPOINT,
  TRUSTED_FOLDERS,
  ADVANCED_CLI_PATH,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_RELEASE_CHANNEL,
  SEVERITY_FILTER_SETTING,
  RISK_SCORE_THRESHOLD_SETTING,
  FOLDER_CONFIGS,
} from '../../../constants/settings';
import { IdeConfigData } from '../types/workspaceConfiguration.types';

export interface IConfigurationMappingService {
  mapConfigToSettings(config: IdeConfigData): Record<string, unknown>;
  mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined;
}

export class ConfigurationMappingService implements IConfigurationMappingService {
  // Map LS HTML values (pat/token/oauth) to package.json enum values
  private readonly authMethodMap: Record<string, string> = {
    oauth: 'OAuth2 (Recommended)',
    pat: 'Personal Access Token',
    token: 'API Token (Legacy)',
  };

  private readonly htmlKeyToVSCodeSettingMap: Record<string, string> = {
    // Scan Settings
    activateSnykOpenSource: OSS_ENABLED_SETTING,
    activateSnykCode: CODE_SECURITY_ENABLED_SETTING,
    activateSnykIac: IAC_ENABLED_SETTING,
    scanningMode: SCANNING_MODE,

    // Issue View Settings
    issueViewOptions: ISSUE_VIEW_OPTIONS_SETTING,
    enableDeltaFindings: DELTA_FINDINGS,

    // Authentication Settings
    authenticationMethod: ADVANCED_AUTHENTICATION_METHOD,

    // Connection Settings
    endpoint: ADVANCED_CUSTOM_ENDPOINT,
    insecure: 'http.proxyStrictSSL',

    // Trusted Folders
    trustedFolders: TRUSTED_FOLDERS,

    // CLI Settings
    cliPath: ADVANCED_CLI_PATH,
    manageBinariesAutomatically: ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
    baseUrl: ADVANCED_CLI_BASE_DOWNLOAD_URL,
    cliReleaseChannel: ADVANCED_CLI_RELEASE_CHANNEL,

    // Filter Settings
    filterSeverity: SEVERITY_FILTER_SETTING,
    riskScoreThreshold: RISK_SCORE_THRESHOLD_SETTING,

    // Folder Configs
    folderConfigs: FOLDER_CONFIGS,
  };

  /**
   * Converts LS HTML auth method values (pat/token/oauth) to package.json enum values
   */
  private normalizeAuthenticationMethod(value: string | undefined): string {
    if (!value) {
      return this.authMethodMap.oauth; // Default to OAuth2
    }

    const normalized = value.toLowerCase().trim();
    return this.authMethodMap[normalized] || this.authMethodMap.oauth;
  }

  mapConfigToSettings(config: IdeConfigData): Record<string, unknown> {
    return {
      // Scan Settings
      [OSS_ENABLED_SETTING]: config.activateSnykOpenSource,
      [CODE_SECURITY_ENABLED_SETTING]: config.activateSnykCode,
      [IAC_ENABLED_SETTING]: config.activateSnykIac,
      [SCANNING_MODE]: config.scanningMode,

      // Issue View Settings
      [ISSUE_VIEW_OPTIONS_SETTING]: config.issueViewOptions,
      [DELTA_FINDINGS]: config.enableDeltaFindings ? 'Net new issues' : 'All issues',

      // Authentication Settings
      [ADVANCED_AUTHENTICATION_METHOD]: this.normalizeAuthenticationMethod(config.authenticationMethod),

      // Connection Settings
      [ADVANCED_CUSTOM_ENDPOINT]: config.endpoint,
      'http.proxyStrictSSL': config.insecure !== undefined ? !config.insecure : undefined,

      // Trusted Folders
      [TRUSTED_FOLDERS]: config.trustedFolders,

      // CLI Settings
      [ADVANCED_CLI_PATH]: config.cliPath,
      [ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT]: config.manageBinariesAutomatically,
      [ADVANCED_CLI_BASE_DOWNLOAD_URL]: config.baseUrl,
      [ADVANCED_CLI_RELEASE_CHANNEL]: config.cliReleaseChannel,

      // Filter Settings
      [SEVERITY_FILTER_SETTING]: config.filterSeverity,
      [RISK_SCORE_THRESHOLD_SETTING]: config.riskScoreThreshold,

      // Folder Configs
      [FOLDER_CONFIGS]: config.folderConfigs,
    };
  }

  mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined {
    // Handle special cases like filterSeverity_critical
    if (htmlKey.startsWith('filterSeverity_')) {
      const severity = htmlKey.replace('filterSeverity_', '');
      return `${SEVERITY_FILTER_SETTING}.${severity}`;
    }

    return this.htmlKeyToVSCodeSettingMap[htmlKey];
  }
}
