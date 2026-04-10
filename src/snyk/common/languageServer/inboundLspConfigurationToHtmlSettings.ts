import type {
  HtmlSettingsData,
  FilterSeverity,
} from '../views/workspaceConfiguration/types/workspaceConfiguration.types';
import { LS_KEY } from './serverSettingsToLspConfigurationParam';
import type { LspConfigSetting } from './types';

function getValue<T>(s: LspConfigSetting | undefined): T | undefined {
  if (!s || s.value === undefined) {
    return undefined;
  }
  return s.value as T;
}

/**
 * Maps global LS key entries from `$/snyk.configuration` into {@link HtmlSettingsData}.
 * Both read keys (globalSettings) and write keys (out.field) use LS key strings.
 */
export function mapLspSettingsToHtmlSettings(
  globalSettings: Record<string, LspConfigSetting>,
): Partial<HtmlSettingsData> {
  const out: Partial<HtmlSettingsData> = {};

  const oss = getValue<boolean>(globalSettings[LS_KEY.snykOssEnabled]);
  if (oss !== undefined) out.snyk_oss_enabled = oss;

  const code = getValue<boolean>(globalSettings[LS_KEY.snykCodeEnabled]);
  if (code !== undefined) out.snyk_code_enabled = code;

  const iac = getValue<boolean>(globalSettings[LS_KEY.snykIacEnabled]);
  if (iac !== undefined) out.snyk_iac_enabled = iac;

  const secrets = getValue<boolean>(globalSettings[LS_KEY.snykSecretsEnabled]);
  if (secrets !== undefined) out.snyk_secrets_enabled = secrets;

  const netNew = getValue<boolean>(globalSettings[LS_KEY.scanNetNew]);
  if (netNew !== undefined) out.scan_net_new = netNew;

  const endpoint = getValue<string>(globalSettings[LS_KEY.apiEndpoint]);
  if (endpoint !== undefined && endpoint !== '') out.api_endpoint = endpoint;

  const binaryBaseUrl = getValue<string>(globalSettings[LS_KEY.binaryBaseUrl]);
  if (binaryBaseUrl !== undefined && binaryBaseUrl !== '') out.binary_base_url = binaryBaseUrl;

  const cliPath = getValue<string>(globalSettings[LS_KEY.cliPath]);
  if (cliPath !== undefined && cliPath !== '') out.cli_path = cliPath;

  const authMethod = getValue<string>(globalSettings[LS_KEY.authenticationMethod]);
  if (authMethod !== undefined && authMethod !== '') out.authentication_method = authMethod.toLowerCase();

  const org = getValue<string>(globalSettings[LS_KEY.organization]);
  if (org !== undefined && org !== '') out.organization = org;

  const autoDl = getValue<boolean>(globalSettings[LS_KEY.automaticDownload]);
  if (autoDl !== undefined) out.automatic_download = autoDl;

  const cliInsecure = getValue<boolean>(globalSettings[LS_KEY.proxyInsecure]);
  if (cliInsecure !== undefined) out.proxy_insecure = cliInsecure;

  const scanAuto = getValue<boolean>(globalSettings[LS_KEY.scanAutomatic]);
  if (scanAuto !== undefined) out.scan_automatic = scanAuto;

  const sev = getValue<FilterSeverity>(globalSettings[LS_KEY.enabledSeverities]);
  if (sev !== undefined) out.enabled_severities = sev;

  const openIv = getValue<boolean>(globalSettings[LS_KEY.issueViewOpenIssues]);
  if (openIv !== undefined) out.issue_view_open_issues = openIv;

  const ignIv = getValue<boolean>(globalSettings[LS_KEY.issueViewIgnoredIssues]);
  if (ignIv !== undefined) out.issue_view_ignored_issues = ignIv;

  const risk = getValue<number>(globalSettings[LS_KEY.riskScoreThreshold]);
  if (risk !== undefined) out.risk_score_threshold = risk;

  const trusted = getValue<string[]>(globalSettings[LS_KEY.trustedFolders]);
  if (trusted !== undefined) out.trusted_folders = trusted;

  const token = getValue<string>(globalSettings[LS_KEY.token]);
  if (token !== undefined && token !== '') out.token = token;

  return out;
}
