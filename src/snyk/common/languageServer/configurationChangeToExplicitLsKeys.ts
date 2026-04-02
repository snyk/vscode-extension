import type { ConfigurationChangeEvent } from '../vscode/types';
import {
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_PATH,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_ORGANIZATION,
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  AUTO_CONFIGURE_MCP_SERVER,
  CODE_SECURITY_ENABLED_SETTING,
  DELTA_FINDINGS,
  HTTP_PROXY_STRICT_SSL_SETTING,
  IAC_ENABLED_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  OSS_ENABLED_SETTING,
  RISK_SCORE_THRESHOLD_SETTING,
  SCANNING_MODE,
  SECRETS_ENABLED_SETTING,
  SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
} from '../constants/settings';
import { LS_KEY } from './serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';

/**
 * Maps VS Code setting keys (`configKey`) to LS configuration keys: snake_case names such as
 * `api_endpoint` and `organization` that appear in `LspConfigurationParam` when sending config to
 * Snyk Language Server. Key map only; does not supply values.
 */
const CONFIG_KEY_TO_LS_KEY: Array<{ configKey: string; lsKeys: string[] }> = [
  { configKey: ADVANCED_CUSTOM_ENDPOINT, lsKeys: [LS_KEY.apiEndpoint] },
  { configKey: ADVANCED_ORGANIZATION, lsKeys: [LS_KEY.organization] },
  { configKey: ADVANCED_AUTHENTICATION_METHOD, lsKeys: [LS_KEY.authenticationMethod] },
  { configKey: ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT, lsKeys: [LS_KEY.automaticDownload] },
  { configKey: ADVANCED_CLI_PATH, lsKeys: [LS_KEY.cliPath] },
  { configKey: ADVANCED_CLI_BASE_DOWNLOAD_URL, lsKeys: [LS_KEY.binaryBaseUrl] },
  { configKey: ADVANCED_ADDITIONAL_PARAMETERS_SETTING, lsKeys: [LS_KEY.additionalParameters] },
  { configKey: OSS_ENABLED_SETTING, lsKeys: [LS_KEY.snykOssEnabled] },
  { configKey: CODE_SECURITY_ENABLED_SETTING, lsKeys: [LS_KEY.snykCodeEnabled] },
  { configKey: IAC_ENABLED_SETTING, lsKeys: [LS_KEY.snykIacEnabled] },
  { configKey: SECRETS_ENABLED_SETTING, lsKeys: [LS_KEY.snykSecretsEnabled] },
  { configKey: SCANNING_MODE, lsKeys: [LS_KEY.scanAutomatic] },
  { configKey: ISSUE_VIEW_OPTIONS_SETTING, lsKeys: [LS_KEY.issueViewOpenIssues, LS_KEY.issueViewIgnoredIssues] },
  { configKey: SEVERITY_FILTER_SETTING, lsKeys: [LS_KEY.enabledSeverities] },
  { configKey: RISK_SCORE_THRESHOLD_SETTING, lsKeys: [LS_KEY.riskScoreThreshold] },
  { configKey: DELTA_FINDINGS, lsKeys: [LS_KEY.scanNetNew] },
  { configKey: TRUSTED_FOLDERS, lsKeys: [LS_KEY.trustedFolders] },
  { configKey: HTTP_PROXY_STRICT_SSL_SETTING, lsKeys: [LS_KEY.cliInsecure] },
  { configKey: AUTO_CONFIGURE_MCP_SERVER, lsKeys: [LS_KEY.autoConfigureMcpServer] },
  { configKey: SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY, lsKeys: [LS_KEY.secureAtInceptionExecutionFreq] },
];

/**
 * When native VS Code configuration changes, mark matching LS keys so outbound
 * `workspace/didChangeConfiguration` sets `ConfigSetting.changed` for user edits.
 */
export function markExplicitLsKeysFromConfigurationChangeEvent(
  e: ConfigurationChangeEvent,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  for (const { configKey, lsKeys } of CONFIG_KEY_TO_LS_KEY) {
    if (e.affectsConfiguration(configKey)) {
      for (const k of lsKeys) {
        tracker.markExplicitlyChanged(k);
      }
    }
  }
}
