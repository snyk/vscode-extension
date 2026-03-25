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
import { PFLAG } from './serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';

const CONFIG_KEY_TO_PFLAG: Array<{ configKey: string; pflags: string[] }> = [
  { configKey: ADVANCED_CUSTOM_ENDPOINT, pflags: [PFLAG.apiEndpoint] },
  { configKey: ADVANCED_ORGANIZATION, pflags: [PFLAG.organization] },
  { configKey: ADVANCED_AUTHENTICATION_METHOD, pflags: [PFLAG.authenticationMethod] },
  { configKey: ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT, pflags: [PFLAG.automaticDownload] },
  { configKey: ADVANCED_CLI_PATH, pflags: [PFLAG.cliPath] },
  { configKey: ADVANCED_CLI_BASE_DOWNLOAD_URL, pflags: [PFLAG.binaryBaseUrl] },
  { configKey: ADVANCED_ADDITIONAL_PARAMETERS_SETTING, pflags: [PFLAG.additionalParameters] },
  { configKey: OSS_ENABLED_SETTING, pflags: [PFLAG.snykOssEnabled] },
  { configKey: CODE_SECURITY_ENABLED_SETTING, pflags: [PFLAG.snykCodeEnabled] },
  { configKey: IAC_ENABLED_SETTING, pflags: [PFLAG.snykIacEnabled] },
  { configKey: SECRETS_ENABLED_SETTING, pflags: [PFLAG.snykSecretsEnabled] },
  { configKey: SCANNING_MODE, pflags: [PFLAG.scanAutomatic] },
  { configKey: ISSUE_VIEW_OPTIONS_SETTING, pflags: [PFLAG.issueViewOpenIssues, PFLAG.issueViewIgnoredIssues] },
  { configKey: SEVERITY_FILTER_SETTING, pflags: [PFLAG.enabledSeverities] },
  { configKey: RISK_SCORE_THRESHOLD_SETTING, pflags: [PFLAG.riskScoreThreshold] },
  { configKey: DELTA_FINDINGS, pflags: [PFLAG.scanNetNew] },
  { configKey: TRUSTED_FOLDERS, pflags: [PFLAG.trustedFolders] },
  { configKey: HTTP_PROXY_STRICT_SSL_SETTING, pflags: [PFLAG.cliInsecure] },
  { configKey: AUTO_CONFIGURE_MCP_SERVER, pflags: [PFLAG.autoConfigureMcpServer] },
  { configKey: SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY, pflags: [PFLAG.secureAtInceptionExecutionFreq] },
];

/**
 * When native VS Code configuration changes, mark matching pflag keys so outbound
 * `workspace/didChangeConfiguration` sets `ConfigSetting.changed` for user edits (IDE-1639 parity).
 */
export function markExplicitPflagsFromConfigurationChangeEvent(
  e: ConfigurationChangeEvent,
  tracker: IExplicitLspConfigurationChangeTracker,
): void {
  for (const { configKey, pflags } of CONFIG_KEY_TO_PFLAG) {
    if (e.affectsConfiguration(configKey)) {
      for (const p of pflags) {
        tracker.markExplicitlyChanged(p);
      }
    }
  }
}
