// ABOUTME: Service for mapping between HtmlSettingsData and VS Code settings
// ABOUTME: Uses LS_KEY_TO_VSCODE_KEY as single source of truth for key mapping
import { ALLISSUES, NEWISSUES } from '../../../configuration/configuration';
import {
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_CLI_RELEASE_CHANNEL,
  AUTH_METHOD_OAUTH,
  AUTH_METHOD_PAT,
  AUTH_METHOD_TOKEN,
  DELTA_FINDINGS,
  HTTP_PROXY_STRICT_SSL_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  SCANNING_MODE,
  SEVERITY_FILTER_SETTING,
} from '../../../constants/settings';
import { LS_KEY } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import { LS_KEY_TO_VSCODE_KEY, lsKeyToVscodeKey } from '../../../languageServer/lsKeyToVscodeKeyMap';
import { HtmlSettingsData } from '../types/workspaceConfiguration.types';

export interface IConfigurationMappingService {
  mapConfigToSettings(config: HtmlSettingsData, isCliOnly: boolean): Record<string, unknown>;
  mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined;
}

/** LS keys that belong to the CLI-only fallback form subset. */
const CLI_ONLY_LS_KEYS = new Set<string>([
  LS_KEY.cliPath,
  LS_KEY.automaticDownload,
  LS_KEY.binaryBaseUrl,
  LS_KEY.proxyInsecure,
]);

/**
 * LS keys that require value transformation before writing to VS Code settings.
 * Maps each LS key to a function that takes the raw HtmlSettingsData value and returns
 * the VS Code setting key + transformed value.
 */
const VALUE_TRANSFORMATIONS: Readonly<Record<string, (value: unknown) => { key: string; value: unknown }>> = {
  [LS_KEY.proxyInsecure]: (v: unknown) => ({ key: HTTP_PROXY_STRICT_SSL_SETTING, value: !v }),
  [LS_KEY.scanNetNew]: (v: unknown) => ({ key: DELTA_FINDINGS, value: v ? NEWISSUES : ALLISSUES }),
  [LS_KEY.scanAutomatic]: (v: unknown) => ({ key: SCANNING_MODE, value: v ? 'auto' : 'manual' }),
  [LS_KEY.authenticationMethod]: (v: unknown) => ({
    key: ADVANCED_AUTHENTICATION_METHOD,
    value: normalizeAuthenticationMethod(v as string | undefined),
  }),
  [LS_KEY.issueViewOpenIssues]: () => ({ key: '', value: undefined }), // handled as composite below
  [LS_KEY.issueViewIgnoredIssues]: () => ({ key: '', value: undefined }), // handled as composite below
};

const AUTH_METHOD_MAP: Record<string, string> = {
  oauth: AUTH_METHOD_OAUTH,
  pat: AUTH_METHOD_PAT,
  token: AUTH_METHOD_TOKEN,
};

function normalizeAuthenticationMethod(value: string | undefined): string {
  if (!value) return AUTH_METHOD_MAP.oauth;
  const normalized = value.toLowerCase().trim();
  return AUTH_METHOD_MAP[normalized] || AUTH_METHOD_MAP.oauth;
}

export class ConfigurationMappingService implements IConfigurationMappingService {
  mapConfigToSettings(config: HtmlSettingsData, isCliOnly: boolean): Record<string, unknown> {
    const configRecord = config as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    // Data-driven: iterate the single LS_KEY_TO_VSCODE_KEY mapping
    for (const [lsKey, vscodeKey] of Object.entries(LS_KEY_TO_VSCODE_KEY)) {
      if (isCliOnly && !CLI_ONLY_LS_KEYS.has(lsKey)) continue;

      const value = configRecord[lsKey];
      if (value === undefined) continue;

      const transform = VALUE_TRANSFORMATIONS[lsKey];
      if (transform) {
        const transformed = transform(value);
        if (transformed.key) {
          result[transformed.key] = transformed.value;
        }
        continue;
      }

      result[vscodeKey] = value;
    }

    // Composite: two LS keys → one VS Code setting
    if (!isCliOnly && (config.issue_view_open_issues !== undefined || config.issue_view_ignored_issues !== undefined)) {
      result[ISSUE_VIEW_OPTIONS_SETTING] = {
        openIssues: config.issue_view_open_issues,
        ignoredIssues: config.issue_view_ignored_issues,
      };
    }

    // IDE-only field (not in LS_KEY_TO_VSCODE_KEY)
    if (config.cli_release_channel !== undefined) {
      result[ADVANCED_CLI_RELEASE_CHANNEL] = config.cli_release_channel;
    }

    return result;
  }

  mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined {
    // Handle severity sub-keys like enabled_severities_critical
    const severityPrefix = `${LS_KEY.enabledSeverities}_`;
    if (htmlKey.startsWith(severityPrefix)) {
      return `${SEVERITY_FILTER_SETTING}.${htmlKey.replace(severityPrefix, '')}`;
    }
    // Legacy camelCase support for LS-generated HTML during transition
    if (htmlKey.startsWith('filterSeverity_')) {
      return `${SEVERITY_FILTER_SETTING}.${htmlKey.replace('filterSeverity_', '')}`;
    }

    return lsKeyToVscodeKey(htmlKey);
  }
}
