import type {
  IdeConfigData,
  FilterSeverity,
  IssueViewOptions,
} from '../views/workspaceConfiguration/types/workspaceConfiguration.types';
import type { MergedLspConfigurationView } from './lspConfigurationMerge';
import { PFLAG } from './serverSettingsToLspConfigurationParam';
import type { LspConfigSetting } from './types';

function getValue<T>(s: LspConfigSetting | undefined): T | undefined {
  if (!s || s.value === undefined) {
    return undefined;
  }
  return s.value as T;
}

/**
 * Settings snapshot to use when persisting inbound `$/snyk.configuration` into VS Code settings.
 * Prefer the merged global+folder map for the first workspace folder path that exists in
 * `folderSettingsByPath` (parity with IntelliJ applying folder-scope toggles from the first folder).
 * Otherwise use the top-level `globalSettings` only.
 */
export function effectiveGlobalSettingsForIdePersistence(
  view: MergedLspConfigurationView,
  workspaceFolderPathsOrdered: string[],
): Record<string, LspConfigSetting> {
  if (workspaceFolderPathsOrdered.length === 0) {
    return view.globalSettings;
  }
  for (const p of workspaceFolderPathsOrdered) {
    const merged = view.folderSettingsByPath[p];
    if (merged !== undefined && Object.keys(merged).length > 0) {
      return merged;
    }
  }
  return view.globalSettings;
}

/**
 * Maps global pflag entries from `$/snyk.configuration` into {@link IdeConfigData} fields so they can be
 * written via {@link ConfigurationMappingService.mapConfigToSettings} (same path as the HTML settings UI).
 */
export function mergedGlobalSettingsToIdeConfigData(
  globalSettings: Record<string, LspConfigSetting>,
): Partial<IdeConfigData> {
  const out: Partial<IdeConfigData> = {};

  const oss = getValue<boolean>(globalSettings[PFLAG.snykOssEnabled]);
  if (oss !== undefined) out.activateSnykOpenSource = oss;

  const code = getValue<boolean>(globalSettings[PFLAG.snykCodeEnabled]);
  if (code !== undefined) out.activateSnykCode = code;

  const iac = getValue<boolean>(globalSettings[PFLAG.snykIacEnabled]);
  if (iac !== undefined) out.activateSnykIac = iac;

  const secrets = getValue<boolean>(globalSettings[PFLAG.snykSecretsEnabled]);
  if (secrets !== undefined) out.activateSnykSecrets = secrets;

  const netNew = getValue<boolean>(globalSettings[PFLAG.scanNetNew]);
  if (netNew !== undefined) out.enableDeltaFindings = netNew;

  const endpoint = getValue<string>(globalSettings[PFLAG.apiEndpoint]);
  if (endpoint !== undefined && endpoint !== '') out.endpoint = endpoint;

  const binaryBaseUrl = getValue<string>(globalSettings[PFLAG.binaryBaseUrl]);
  if (binaryBaseUrl !== undefined && binaryBaseUrl !== '') out.cliBaseDownloadURL = binaryBaseUrl;

  const cliPath = getValue<string>(globalSettings[PFLAG.cliPath]);
  if (cliPath !== undefined && cliPath !== '') out.cliPath = cliPath;

  const authMethod = getValue<string>(globalSettings[PFLAG.authenticationMethod]);
  if (authMethod !== undefined && authMethod !== '') out.authenticationMethod = authMethod.toLowerCase();

  const org = getValue<string>(globalSettings[PFLAG.organization]);
  if (org !== undefined && org !== '') out.organization = org;

  const autoDl = getValue<boolean>(globalSettings[PFLAG.automaticDownload]);
  if (autoDl !== undefined) out.manageBinariesAutomatically = autoDl;

  const cliInsecure = getValue<boolean>(globalSettings[PFLAG.cliInsecure]);
  if (cliInsecure !== undefined) out.insecure = cliInsecure;

  const scanAuto = getValue<boolean>(globalSettings[PFLAG.scanAutomatic]);
  if (scanAuto !== undefined) {
    out.scanningMode = scanAuto ? 'auto' : 'manual';
  }

  const sev = getValue<FilterSeverity>(globalSettings[PFLAG.enabledSeverities]);
  if (sev !== undefined) out.filterSeverity = sev;

  const openIv = getValue<boolean>(globalSettings[PFLAG.issueViewOpenIssues]);
  const ignIv = getValue<boolean>(globalSettings[PFLAG.issueViewIgnoredIssues]);
  if (openIv !== undefined || ignIv !== undefined) {
    const ivo: IssueViewOptions = {};
    if (openIv !== undefined) ivo.openIssues = openIv;
    if (ignIv !== undefined) ivo.ignoredIssues = ignIv;
    out.issueViewOptions = ivo;
  }

  const risk = getValue<number>(globalSettings[PFLAG.riskScoreThreshold]);
  if (risk !== undefined) out.riskScoreThreshold = risk;

  const trusted = getValue<string[]>(globalSettings[PFLAG.trustedFolders]);
  if (trusted !== undefined && trusted.length > 0) out.trustedFolders = trusted;

  const token = getValue<string>(globalSettings[PFLAG.token]);
  if (token !== undefined && token !== '') out.token = token;

  return out;
}
