import type { FolderConfig } from '../configuration/configuration';
import type { LspConfigurationParam, LspConfigSetting, LspFolderConfiguration } from './types';
import type { ServerSettings } from './settings';

/**
 * Pflag keys aligned with snyk-ls `internal/types/ldx_sync_config.go` and
 * `legacySettingsToLspConfigurationParam` in `application/server/workspace_configuration_pull.go`.
 */
export const PFLAG = {
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
  cliInsecure: 'cli_insecure',
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

/** Returns true when the IDE should mark `ConfigSetting.changed` for outbound LS config (IDE-1639 parity). */
export type ExplicitChangePredicate = (pflagKey: string) => boolean;

const PFLAG_ALWAYS_CHANGED_FALSE = new Set<string>([PFLAG.sendErrorReports, PFLAG.enableSnykOssQuickFixActions]);

const PFLAG_ALWAYS_CHANGED_TRUE = new Set<string>([
  PFLAG.trustEnabled,
  PFLAG.automaticAuthentication,
  PFLAG.hoverVerbosity,
]);

function resolveChanged(pflagKey: string, value: unknown, isExplicitlyChanged: ExplicitChangePredicate): boolean {
  if (PFLAG_ALWAYS_CHANGED_FALSE.has(pflagKey)) {
    return false;
  }
  if (PFLAG_ALWAYS_CHANGED_TRUE.has(pflagKey)) {
    return true;
  }
  if (pflagKey === PFLAG.token && value !== undefined && value !== '') {
    return true;
  }
  if (
    pflagKey === PFLAG.trustedFolders &&
    value !== undefined &&
    Array.isArray(value) &&
    (value as unknown[]).length > 0
  ) {
    return true;
  }
  return isExplicitlyChanged(pflagKey);
}

function putSetting(
  out: Record<string, LspConfigSetting>,
  key: string,
  value: unknown,
  isExplicitlyChanged: ExplicitChangePredicate,
): void {
  out[key] = { value, changed: resolveChanged(key, value, isExplicitlyChanged) };
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
 * Maps IDE `FolderConfig` (in-memory / extension model) to LS `LspFolderConfiguration`
 * (pflag-keyed `settings` per folder).
 */
export function folderConfigToLspFolderConfiguration(
  fc: FolderConfig,
  isExplicitlyChanged: ExplicitChangePredicate = () => true,
): LspFolderConfiguration {
  const settings: Record<string, LspConfigSetting> = {};

  putSetting(settings, PFLAG.preferredOrg, fc.preferredOrg, isExplicitlyChanged);
  //autoDeterminedOrg comes from Snyk Language Server and can not be set from IDE.
  putSetting(settings, PFLAG.autoDeterminedOrg, fc.autoDeterminedOrg, isExplicitlyChanged);
  putSetting(settings, PFLAG.orgSetByUser, fc.orgSetByUser, isExplicitlyChanged);

  if (fc.scanCommandConfig !== undefined) {
    putSetting(settings, PFLAG.scanCommandConfig, fc.scanCommandConfig, isExplicitlyChanged);
  }
  //TODO: baseBranch, localBranches, referenceFolderPath are set separatly, not as a part of updating configurations.
  //Make sure that we update branches correctly in delta flow.
  if (fc.baseBranch !== undefined && fc.baseBranch !== '') {
    putSetting(settings, PFLAG.baseBranch, fc.baseBranch, isExplicitlyChanged);
  }
  if (fc.localBranches !== undefined && fc.localBranches.length > 0) {
    putSetting(settings, PFLAG.localBranches, fc.localBranches, isExplicitlyChanged);
  }
  if (fc.referenceFolderPath !== undefined && fc.referenceFolderPath !== '') {
    putSetting(settings, PFLAG.referenceFolder, fc.referenceFolderPath, isExplicitlyChanged);
  }
  //sastSettings set and used only in Snyk Language Server

  return { folderPath: fc.folderPath, settings };
}

/**
 * Converts flat `ServerSettings` (VS Code / `LanguageServerSettings.fromConfiguration`) plus embedded
 * `folderConfigs` into snyk-ls **`LspConfigurationParam`**: global pflag `settings` and `folderConfigs`.
 * Each emitted `LspConfigSetting` uses **`value`** and **`changed`** derived from
 * {@link ExplicitChangePredicate} (IntelliJ explicit-changes parity; default: all `changed: true`).
 */
export function serverSettingsToLspConfigurationParam(
  settings: ServerSettings,
  isExplicitlyChanged: ExplicitChangePredicate = () => true,
): LspConfigurationParam {
  const m: Record<string, LspConfigSetting> = {};

  putBoolStr(m, PFLAG.snykCodeEnabled, settings.activateSnykCodeSecurity, isExplicitlyChanged);
  putBoolStr(m, PFLAG.snykOssEnabled, settings.activateSnykOpenSource, isExplicitlyChanged);
  putBoolStr(m, PFLAG.snykIacEnabled, settings.activateSnykIac, isExplicitlyChanged);
  putBoolStr(m, PFLAG.snykSecretsEnabled, settings.activateSnykSecrets, isExplicitlyChanged);

  putBoolStr(m, PFLAG.scanNetNew, settings.enableDeltaFindings, isExplicitlyChanged);
  putBoolStr(m, PFLAG.sendErrorReports, settings.sendErrorReports, isExplicitlyChanged);
  putBoolStr(m, PFLAG.trustEnabled, settings.enableTrustedFoldersFeature, isExplicitlyChanged);
  putBoolStr(m, PFLAG.automaticDownload, settings.manageBinariesAutomatically, isExplicitlyChanged);
  putBoolStr(m, PFLAG.cliInsecure, settings.insecure, isExplicitlyChanged);
  putBoolStr(m, PFLAG.enableSnykOssQuickFixActions, settings.enableSnykOSSQuickFixCodeActions, isExplicitlyChanged);
  putBoolStr(m, PFLAG.autoConfigureMcpServer, settings.autoConfigureSnykMcpServer, isExplicitlyChanged);

  if (settings.endpoint !== undefined && settings.endpoint !== '') {
    putSetting(m, PFLAG.apiEndpoint, settings.endpoint, isExplicitlyChanged);
  }
  if (settings.cliBaseDownloadURL !== undefined && settings.cliBaseDownloadURL !== '') {
    putSetting(m, PFLAG.binaryBaseUrl, settings.cliBaseDownloadURL, isExplicitlyChanged);
  }
  if (settings.cliPath !== undefined && settings.cliPath !== '') {
    putSetting(m, PFLAG.cliPath, settings.cliPath, isExplicitlyChanged);
  }
  if (settings.token !== undefined && settings.token !== '') {
    putSetting(m, PFLAG.token, settings.token, isExplicitlyChanged);
  }
  if (settings.organization !== undefined && settings.organization !== '') {
    putSetting(m, PFLAG.organization, settings.organization, isExplicitlyChanged);
  }
  if (settings.authenticationMethod !== undefined && settings.authenticationMethod !== '') {
    putSetting(m, PFLAG.authenticationMethod, settings.authenticationMethod, isExplicitlyChanged);
  }
  putBoolStr(m, PFLAG.automaticAuthentication, settings.automaticAuthentication, isExplicitlyChanged);

  if (settings.additionalParams !== undefined && settings.additionalParams !== '') {
    putSetting(m, PFLAG.additionalParameters, settings.additionalParams, isExplicitlyChanged);
  }
  if (settings.additionalEnv !== undefined && settings.additionalEnv !== '') {
    putSetting(m, PFLAG.additionalEnvironment, settings.additionalEnv, isExplicitlyChanged);
  }

  if (settings.scanningMode !== undefined && settings.scanningMode !== '') {
    putSetting(m, PFLAG.scanAutomatic, settings.scanningMode !== 'manual', isExplicitlyChanged);
  }

  if (settings.filterSeverity !== undefined) {
    const sf = settings.filterSeverity;
    putSetting(
      m,
      PFLAG.enabledSeverities,
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
    putSetting(m, PFLAG.issueViewOpenIssues, ivo.openIssues, isExplicitlyChanged);
    putSetting(m, PFLAG.issueViewIgnoredIssues, ivo.ignoredIssues, isExplicitlyChanged);
  }
  if (settings.riskScoreThreshold !== undefined) {
    putSetting(m, PFLAG.riskScoreThreshold, settings.riskScoreThreshold, isExplicitlyChanged);
  }
  if (settings.hoverVerbosity !== undefined) {
    putSetting(m, PFLAG.hoverVerbosity, settings.hoverVerbosity, isExplicitlyChanged);
  }

  if (settings.trustedFolders !== undefined && settings.trustedFolders.length > 0) {
    putSetting(m, PFLAG.trustedFolders, settings.trustedFolders, isExplicitlyChanged);
  }

  if (
    settings.secureAtInceptionExecutionFrequency !== undefined &&
    settings.secureAtInceptionExecutionFrequency !== ''
  ) {
    putSetting(
      m,
      PFLAG.secureAtInceptionExecutionFreq,
      settings.secureAtInceptionExecutionFrequency,
      isExplicitlyChanged,
    );
  }

  const folderConfigs = settings.folderConfigs?.length
    ? settings.folderConfigs.map(fc => folderConfigToLspFolderConfiguration(fc, isExplicitlyChanged))
    : undefined;

  const result: LspConfigurationParam = { settings: m };
  if (folderConfigs !== undefined) {
    result.folderConfigs = folderConfigs;
  }
  return result;
}
