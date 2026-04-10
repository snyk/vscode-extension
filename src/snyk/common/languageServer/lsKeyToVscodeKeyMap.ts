import { LS_KEY } from './serverSettingsToLspConfigurationParam';
import {
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_PATH,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_ORGANIZATION,
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

/**
 * Single source of truth mapping LS configuration keys to VS Code setting keys.
 *
 * All other lookups (VS Code key → LS keys, IDE config field → VS Code key) derive from this map.
 * Multiple LS keys may share a single VS Code key (e.g. issue_view_open_issues and
 * issue_view_ignored_issues both map to the composite snyk.issueViewOptions setting).
 */
export const LS_KEY_TO_VSCODE_KEY: Readonly<Record<string, string>> = {
  [LS_KEY.apiEndpoint]: ADVANCED_CUSTOM_ENDPOINT,
  [LS_KEY.organization]: ADVANCED_ORGANIZATION,
  [LS_KEY.authenticationMethod]: ADVANCED_AUTHENTICATION_METHOD,
  [LS_KEY.automaticDownload]: ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  [LS_KEY.cliPath]: ADVANCED_CLI_PATH,
  [LS_KEY.binaryBaseUrl]: ADVANCED_CLI_BASE_DOWNLOAD_URL,
  [LS_KEY.additionalParameters]: ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  [LS_KEY.snykOssEnabled]: OSS_ENABLED_SETTING,
  [LS_KEY.snykCodeEnabled]: CODE_SECURITY_ENABLED_SETTING,
  [LS_KEY.snykIacEnabled]: IAC_ENABLED_SETTING,
  [LS_KEY.snykSecretsEnabled]: SECRETS_ENABLED_SETTING,
  [LS_KEY.scanAutomatic]: SCANNING_MODE,
  [LS_KEY.issueViewOpenIssues]: ISSUE_VIEW_OPTIONS_SETTING,
  [LS_KEY.issueViewIgnoredIssues]: ISSUE_VIEW_OPTIONS_SETTING,
  [LS_KEY.enabledSeverities]: SEVERITY_FILTER_SETTING,
  [LS_KEY.riskScoreThreshold]: RISK_SCORE_THRESHOLD_SETTING,
  [LS_KEY.scanNetNew]: DELTA_FINDINGS,
  [LS_KEY.trustedFolders]: TRUSTED_FOLDERS,
  [LS_KEY.proxyInsecure]: HTTP_PROXY_STRICT_SSL_SETTING,
  [LS_KEY.autoConfigureMcpServer]: AUTO_CONFIGURE_MCP_SERVER,
  [LS_KEY.secureAtInceptionExecutionFreq]: SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
};

/** Pre-computed reverse index: VS Code setting key → LS keys that map to it. */
const VSCODE_KEY_TO_LS_KEYS: Readonly<Record<string, string[]>> = (() => {
  const reverse: Record<string, string[]> = {};
  for (const [lsKey, vscodeKey] of Object.entries(LS_KEY_TO_VSCODE_KEY)) {
    (reverse[vscodeKey] ??= []).push(lsKey);
  }
  return reverse;
})();

/** Returns all LS keys affected by a VS Code configuration change. */
export function vscodeKeyToLsKeys(vscodeKey: string): string[] {
  return VSCODE_KEY_TO_LS_KEYS[vscodeKey] ?? [];
}

/** Returns the VS Code setting key for a given LS key, or undefined if unmapped. */
export function lsKeyToVscodeKey(lsKey: string): string | undefined {
  return LS_KEY_TO_VSCODE_KEY[lsKey];
}
