import type {
  IdeConfigData,
  FilterSeverity,
  IssueViewOptions,
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
 * Maps global LS key entries from `$/snyk.configuration` into {@link IdeConfigData} fields so they can be
 * written via {@link ConfigurationMappingService.mapConfigToSettings} (same path as the HTML settings UI).
 */
export function mergedGlobalSettingsToIdeConfigData(
  globalSettings: Record<string, LspConfigSetting>,
): Partial<IdeConfigData> {
  const out: Partial<IdeConfigData> = {};

  const oss = getValue<boolean>(globalSettings[LS_KEY.snykOssEnabled]);
  if (oss !== undefined) out.activateSnykOpenSource = oss;

  const code = getValue<boolean>(globalSettings[LS_KEY.snykCodeEnabled]);
  if (code !== undefined) out.activateSnykCode = code;

  const iac = getValue<boolean>(globalSettings[LS_KEY.snykIacEnabled]);
  if (iac !== undefined) out.activateSnykIac = iac;

  const secrets = getValue<boolean>(globalSettings[LS_KEY.snykSecretsEnabled]);
  if (secrets !== undefined) out.activateSnykSecrets = secrets;

  const netNew = getValue<boolean>(globalSettings[LS_KEY.scanNetNew]);
  if (netNew !== undefined) out.enableDeltaFindings = netNew;

  const endpoint = getValue<string>(globalSettings[LS_KEY.apiEndpoint]);
  if (endpoint !== undefined && endpoint !== '') out.endpoint = endpoint;

  const binaryBaseUrl = getValue<string>(globalSettings[LS_KEY.binaryBaseUrl]);
  if (binaryBaseUrl !== undefined && binaryBaseUrl !== '') out.cliBaseDownloadURL = binaryBaseUrl;

  const cliPath = getValue<string>(globalSettings[LS_KEY.cliPath]);
  if (cliPath !== undefined && cliPath !== '') out.cliPath = cliPath;

  const authMethod = getValue<string>(globalSettings[LS_KEY.authenticationMethod]);
  if (authMethod !== undefined && authMethod !== '') out.authenticationMethod = authMethod.toLowerCase();

  const org = getValue<string>(globalSettings[LS_KEY.organization]);
  if (org !== undefined && org !== '') out.organization = org;

  const autoDl = getValue<boolean>(globalSettings[LS_KEY.automaticDownload]);
  if (autoDl !== undefined) out.manageBinariesAutomatically = autoDl;

  const cliInsecure = getValue<boolean>(globalSettings[LS_KEY.cliInsecure]);
  if (cliInsecure !== undefined) out.insecure = cliInsecure;

  const scanAuto = getValue<boolean>(globalSettings[LS_KEY.scanAutomatic]);
  if (scanAuto !== undefined) {
    out.scanningMode = scanAuto ? 'auto' : 'manual';
  }

  const sev = getValue<FilterSeverity>(globalSettings[LS_KEY.enabledSeverities]);
  if (sev !== undefined) out.filterSeverity = sev;

  const openIv = getValue<boolean>(globalSettings[LS_KEY.issueViewOpenIssues]);
  const ignIv = getValue<boolean>(globalSettings[LS_KEY.issueViewIgnoredIssues]);
  if (openIv !== undefined || ignIv !== undefined) {
    const ivo: IssueViewOptions = {};
    if (openIv !== undefined) ivo.openIssues = openIv;
    if (ignIv !== undefined) ivo.ignoredIssues = ignIv;
    out.issueViewOptions = ivo;
  }

  const risk = getValue<number>(globalSettings[LS_KEY.riskScoreThreshold]);
  if (risk !== undefined) out.riskScoreThreshold = risk;

  const trusted = getValue<string[]>(globalSettings[LS_KEY.trustedFolders]);
  if (trusted !== undefined) out.trustedFolders = trusted;

  const token = getValue<string>(globalSettings[LS_KEY.token]);
  if (token !== undefined && token !== '') out.token = token;

  return out;
}
