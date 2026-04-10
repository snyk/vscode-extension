import type { FolderConfig } from '../configuration/configuration';
import type { LspConfigurationParam, LspConfigSetting } from './types';

/**
 * LSP configuration keys aligned with snyk-ls `internal/types/ldx_sync_config.go`.
 * Single source of truth: renaming a value here propagates to {@link HtmlSettingsData}
 * and all access sites that use `config[LS_KEY.x]`.
 */
export const LS_KEY = {
  apiEndpoint: 'api_endpoint',
  binaryBaseUrl: 'binary_base_url',
  cliPath: 'cli_path',
  token: 'token',
  organization: 'organization',
  authenticationMethod: 'authentication_method',
  automaticAuthentication: 'automatic_authentication',
  additionalParameters: 'additional_parameters',
  additionalEnvironment: 'additional_environment',
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
  enabledSeverities: 'enabled_severities',
  issueViewOpenIssues: 'issue_view_open_issues',
  issueViewIgnoredIssues: 'issue_view_ignored_issues',
  riskScoreThreshold: 'risk_score_threshold',
  hoverVerbosity: 'hover_verbosity',
  trustedFolders: 'trusted_folders',
  secureAtInceptionExecutionFreq: 'secure_at_inception_execution_frequency',
  preferredOrg: 'preferred_org',
  autoDeterminedOrg: 'auto_determined_org',
  orgSetByUser: 'org_set_by_user',
  scanCommandConfig: 'scan_command_config',
  baseBranch: 'base_branch',
  localBranches: 'local_branches',
  referenceFolder: 'reference_folder',
  featureFlags: 'feature_flags',
} as const;

/** Returns true when the IDE should mark `ConfigSetting.changed` for outbound LS config. */
export type ExplicitChangePredicate = (lsKey: string) => boolean;

export function putSetting(
  out: Record<string, LspConfigSetting>,
  key: string,
  value: unknown,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  out[key] = {
    value,
    changed: isExplicitlyChanged(key),
  };
}

/**
 * Emits the string value when non-empty, or `{ value: null, changed: true }` when the user has
 * explicitly cleared the setting. This tells the LS to remove the user override and revert to
 * the resolved default.
 */
export function putStringOrReset(
  out: Record<string, LspConfigSetting>,
  key: string,
  value: string | undefined | null,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  if (value != null && value.trim() !== '') {
    putSetting(out, key, value, isExplicitlyChanged);
  } else if (value === null && isExplicitlyChanged(key)) {
    // Explicit null: user reset the setting — tell LS to revert to the resolved default.
    out[key] = { value: null, changed: true };
  } else if (value != null && isExplicitlyChanged(key)) {
    // Empty/whitespace string: forward as-is so LS sees the user's intent.
    putSetting(out, key, value, isExplicitlyChanged);
  }
}

export function putBoolStr(
  out: Record<string, LspConfigSetting>,
  key: string,
  str: string | undefined,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  if (str === undefined || str === '') {
    return;
  }
  const lower = str.toLowerCase();
  if (lower !== 'true' && lower !== 'false') {
    return;
  }
  putSetting(out, key, lower === 'true', isExplicitlyChanged);
}

/**
 * Delegates to {@link FolderConfig.toLspFolderConfiguration} — the FolderConfig class
 * already stores settings in LSP format, so no conversion is needed.
 */
export function folderConfigToLspFolderConfiguration(fc: FolderConfig) {
  return fc.toLspFolderConfiguration();
}
