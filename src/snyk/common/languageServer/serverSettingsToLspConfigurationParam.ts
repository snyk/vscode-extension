import type { FolderConfig } from '../configuration/configuration';

/**
 * LSP configuration keys aligned with snyk-ls `internal/types/ldx_sync_config.go`.
 *
 * Global settings are in LS_GLOBAL_KEY — each must have a matching entry in
 * SETTINGS_REGISTRY (compile error otherwise).
 * Folder-config-only settings are in LS_FOLDER_KEY.
 */
export const LS_GLOBAL_KEY = {
  apiEndpoint: 'api_endpoint',
  binaryBaseUrl: 'binary_base_url',
  cliPath: 'cli_path',
  token: 'token',
  organization: 'organization',
  authenticationMethod: 'authentication_method',
  automaticAuthentication: 'automatic_authentication',
  additionalParameters: 'additional_parameters',
  snykCodeEnabled: 'snyk_code_enabled',
  snykOssEnabled: 'snyk_oss_enabled',
  snykIacEnabled: 'snyk_iac_enabled',
  snykSecretsEnabled: 'snyk_secrets_enabled',
  scanNetNew: 'scan_net_new',
  sendErrorReports: 'send_error_reports',
  trustEnabled: 'trust_enabled',
  automaticDownload: 'automatic_download',
  proxyInsecure: 'proxy_insecure',
  enableSnykOssQuickFixActions: 'enable_snyk_oss_quick_fix_code_actions',
  autoConfigureMcpServer: 'auto_configure_mcp_server',
  scanAutomatic: 'scan_automatic',
  severityFilterCritical: 'severity_filter_critical',
  severityFilterHigh: 'severity_filter_high',
  severityFilterMedium: 'severity_filter_medium',
  severityFilterLow: 'severity_filter_low',
  issueViewOpenIssues: 'issue_view_open_issues',
  issueViewIgnoredIssues: 'issue_view_ignored_issues',
  riskScoreThreshold: 'risk_score_threshold',
  hoverVerbosity: 'hover_verbosity',
  trustedFolders: 'trusted_folders',
  secureAtInceptionExecutionFreq: 'secure_at_inception_execution_frequency',
} as const;

const LS_FOLDER_KEY = {
  additionalEnvironment: 'additional_environment',
  preferredOrg: 'preferred_org',
  autoDeterminedOrg: 'auto_determined_org',
  orgSetByUser: 'org_set_by_user',
  scanCommandConfig: 'scan_command_config',
  baseBranch: 'base_branch',
  localBranches: 'local_branches',
  referenceFolder: 'reference_folder',
  featureFlags: 'feature_flags',
} as const;

/** Combined global + folder LS keys. */
export const LS_KEY = { ...LS_GLOBAL_KEY, ...LS_FOLDER_KEY } as const;

/** String-literal union of all global LS key values. */
export type GlobalLsKeyValue = typeof LS_GLOBAL_KEY[keyof typeof LS_GLOBAL_KEY];

/** Returns true when the IDE should mark `ConfigSetting.changed` for outbound LS config. */
export type ExplicitChangePredicate = (lsKey: string) => boolean;

/**
 * Delegates to {@link FolderConfig.toLspFolderConfiguration} — the FolderConfig class
 * already stores settings in LSP format, so no conversion is needed.
 */
export function folderConfigToLspFolderConfiguration(fc: FolderConfig) {
  return fc.toLspFolderConfiguration();
}
