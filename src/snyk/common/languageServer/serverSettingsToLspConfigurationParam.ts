import type { FolderConfig } from '../configuration/configuration';
import type { LspConfigurationParam, LspConfigSetting, LspInitializationOptions } from './types';
import type { ServerSettings } from './settings';

/**
 * LSP configuration keys aligned with snyk-ls `internal/types/ldx_sync_config.go` and
 * `legacySettingsToLspConfigurationParam` in `application/server/workspace_configuration_pull.go`.
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
  cliInsecure: 'proxy_insecure',
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
  sastSettings: 'sast_settings',
} as const;

/** Returns true when the IDE should mark `ConfigSetting.changed` for outbound LS config. */
export type ExplicitChangePredicate = (lsKey: string) => boolean;

const LS_KEY_ALWAYS_CHANGED_FALSE = new Set<string>([LS_KEY.sendErrorReports, LS_KEY.enableSnykOssQuickFixActions]);

const LS_KEY_ALWAYS_CHANGED_TRUE = new Set<string>([
  LS_KEY.trustEnabled,
  LS_KEY.automaticAuthentication,
  LS_KEY.hoverVerbosity,
]);

function resolveChanged(lsKey: string, value: unknown, isExplicitlyChanged: ExplicitChangePredicate): boolean {
  if (LS_KEY_ALWAYS_CHANGED_FALSE.has(lsKey)) {
    return false;
  }
  if (LS_KEY_ALWAYS_CHANGED_TRUE.has(lsKey)) {
    return true;
  }
  if (lsKey === LS_KEY.token && typeof value === 'string' && value.trim()) {
    return true;
  }
  if (lsKey === LS_KEY.trustedFolders && value !== undefined && Array.isArray(value)) {
    return true;
  }
  return isExplicitlyChanged(lsKey);
}

function putSetting(
  out: Record<string, LspConfigSetting>,
  key: string,
  value: unknown,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  out[key] = { value, changed: resolveChanged(key, value, isExplicitlyChanged) };
}

/**
 * Emits the string value when non-empty, or `{ value: null, changed: true }` when the user has
 * explicitly cleared the setting. This tells the LS to remove the user override and revert to
 * the resolved default.
 */
function putStringOrReset(
  out: Record<string, LspConfigSetting>,
  key: string,
  value: string | undefined | null,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  if (value != null && value.trim() !== '') {
    putSetting(out, key, value, isExplicitlyChanged);
  } else if (value == null && isExplicitlyChanged(key)) {
    out[key] = { value: null, changed: true };
  }
}

function putBoolStr(
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

/**
 * Converts flat `ServerSettings` (VS Code / `LanguageServerSettings.fromConfiguration`) plus embedded
 * `folderConfigs` into snyk-ls **`LspConfigurationParam`**: global LS-keyed `settings` and `folderConfigs`.
 * Each emitted `LspConfigSetting` uses **`value`** and **`changed`** derived from
 * {@link ExplicitChangePredicate} (IntelliJ explicit-changes parity; default: all `changed: true`).
 */
export function serverSettingsToLspConfigurationParam(
  settings: ServerSettings,
  isExplicitlyChanged: ExplicitChangePredicate = () => true,
): LspConfigurationParam {
  const m: Record<string, LspConfigSetting> = {};

  putBoolStr(m, LS_KEY.snykCodeEnabled, settings.activateSnykCodeSecurity, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.snykOssEnabled, settings.activateSnykOpenSource, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.snykIacEnabled, settings.activateSnykIac, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.snykSecretsEnabled, settings.activateSnykSecrets, isExplicitlyChanged);

  putBoolStr(m, LS_KEY.scanNetNew, settings.enableDeltaFindings, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.sendErrorReports, settings.sendErrorReports, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.trustEnabled, settings.enableTrustedFoldersFeature, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.automaticDownload, settings.manageBinariesAutomatically, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.cliInsecure, settings.insecure, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.enableSnykOssQuickFixActions, settings.enableSnykOSSQuickFixCodeActions, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.autoConfigureMcpServer, settings.autoConfigureSnykMcpServer, isExplicitlyChanged);

  putStringOrReset(m, LS_KEY.apiEndpoint, settings.endpoint, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.binaryBaseUrl, settings.cliBaseDownloadURL, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.cliPath, settings.cliPath, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.token, settings.token, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.organization, settings.organization, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.authenticationMethod, settings.authenticationMethod, isExplicitlyChanged);
  putBoolStr(m, LS_KEY.automaticAuthentication, settings.automaticAuthentication, isExplicitlyChanged);

  putStringOrReset(m, LS_KEY.additionalParameters, settings.additionalParams, isExplicitlyChanged);
  putStringOrReset(m, LS_KEY.additionalEnvironment, settings.additionalEnv, isExplicitlyChanged);

  if (settings.scanningMode !== undefined && settings.scanningMode !== '') {
    putSetting(m, LS_KEY.scanAutomatic, settings.scanningMode !== 'manual', isExplicitlyChanged);
  }

  if (settings.filterSeverity !== undefined) {
    const sf = settings.filterSeverity;
    putSetting(
      m,
      LS_KEY.enabledSeverities,
      {
        critical: sf.critical,
        high: sf.high,
        medium: sf.medium,
        low: sf.low,
      },
      isExplicitlyChanged,
    );
  }
  if (settings.issueViewOptions !== undefined) {
    const ivo = settings.issueViewOptions;
    putSetting(m, LS_KEY.issueViewOpenIssues, ivo.openIssues, isExplicitlyChanged);
    putSetting(m, LS_KEY.issueViewIgnoredIssues, ivo.ignoredIssues, isExplicitlyChanged);
  }
  if (settings.riskScoreThreshold != null) {
    putSetting(m, LS_KEY.riskScoreThreshold, settings.riskScoreThreshold, isExplicitlyChanged);
  }
  if (settings.hoverVerbosity !== undefined) {
    putSetting(m, LS_KEY.hoverVerbosity, settings.hoverVerbosity, isExplicitlyChanged);
  }

  if (settings.trustedFolders !== undefined) {
    putSetting(m, LS_KEY.trustedFolders, settings.trustedFolders, isExplicitlyChanged);
  }

  if (
    settings.secureAtInceptionExecutionFrequency !== undefined &&
    settings.secureAtInceptionExecutionFrequency !== ''
  ) {
    putSetting(
      m,
      LS_KEY.secureAtInceptionExecutionFreq,
      settings.secureAtInceptionExecutionFrequency,
      isExplicitlyChanged,
    );
  }

  const folderConfigs = settings.folderConfigs?.length
    ? settings.folderConfigs.map(fc => folderConfigToLspFolderConfiguration(fc))
    : undefined;

  const result: LspConfigurationParam = { settings: m };
  if (folderConfigs !== undefined) {
    result.folderConfigs = folderConfigs;
  }
  return result;
}

/**
 * Builds snyk-ls `InitializationOptions`: LS-keyed `settings` + `folderConfigs`, plus init-only metadata
 * fields (mirrors `internal/types/lsp.go` `InitializationOptions`).
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- `lsp` is LspConfigurationParam; member access is safe */
export function serverSettingsToLspInitializationOptions(flat: ServerSettings): LspInitializationOptions {
  const lsp: LspConfigurationParam = serverSettingsToLspConfigurationParam(flat, () => true);
  const out: LspInitializationOptions = {
    settings: lsp.settings ?? {},
    requiredProtocolVersion: flat.requiredProtocolVersion,
    deviceId: flat.deviceId,
    integrationName: flat.integrationName,
    integrationVersion: flat.integrationVersion,
    osPlatform: flat.osPlatform,
    osArch: flat.osArch,
    runtimeVersion: flat.runtimeVersion,
    runtimeName: flat.runtimeName,
    hoverVerbosity: flat.hoverVerbosity,
    path: flat.path,
    trustedFolders: flat.trustedFolders,
  };
  if (lsp.folderConfigs !== undefined) {
    out.folderConfigs = lsp.folderConfigs;
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
