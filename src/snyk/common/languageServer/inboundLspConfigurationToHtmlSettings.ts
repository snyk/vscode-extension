import type { HtmlSettingsData } from '../views/workspaceConfiguration/types/workspaceConfiguration.types';
import { LS_KEY } from './serverSettingsToLspConfigurationParam';
import type { LspConfigSetting } from './types';

/** LS keys that are mapped directly to HtmlSettingsData fields (field names match LS key values). */
const HTML_MAPPED_LS_KEYS: ReadonlySet<string> = new Set([
  LS_KEY.snykOssEnabled,
  LS_KEY.snykCodeEnabled,
  LS_KEY.snykIacEnabled,
  LS_KEY.snykSecretsEnabled,
  LS_KEY.scanNetNew,
  LS_KEY.apiEndpoint,
  LS_KEY.binaryBaseUrl,
  LS_KEY.cliPath,
  LS_KEY.authenticationMethod,
  LS_KEY.organization,
  LS_KEY.automaticDownload,
  LS_KEY.proxyInsecure,
  LS_KEY.scanAutomatic,
  LS_KEY.enabledSeverities,
  LS_KEY.issueViewOpenIssues,
  LS_KEY.issueViewIgnoredIssues,
  LS_KEY.riskScoreThreshold,
  LS_KEY.trustedFolders,
  LS_KEY.token,
]);

/** String-valued LS keys where empty strings should be filtered out. */
const FILTER_EMPTY_STRING_KEYS: ReadonlySet<string> = new Set([
  LS_KEY.apiEndpoint,
  LS_KEY.binaryBaseUrl,
  LS_KEY.cliPath,
  LS_KEY.authenticationMethod,
  LS_KEY.organization,
  LS_KEY.token,
]);

/**
 * Maps global LS key entries from `$/snyk.configuration` into {@link HtmlSettingsData}.
 * HtmlSettingsData field names match LS key values, so the mapping is data-driven.
 */
export function mapLspSettingsToHtmlSettings(
  globalSettings: Record<string, LspConfigSetting>,
): Partial<HtmlSettingsData> {
  const out: Record<string, unknown> = {};

  for (const lsKey of HTML_MAPPED_LS_KEYS) {
    const value = globalSettings[lsKey]?.value;
    if (value === undefined) continue;
    if (FILTER_EMPTY_STRING_KEYS.has(lsKey) && value === '') continue;
    out[lsKey] = lsKey === LS_KEY.authenticationMethod && typeof value === 'string' ? value.toLowerCase() : value;
  }

  return out as Partial<HtmlSettingsData>;
}
