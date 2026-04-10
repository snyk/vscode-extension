// ABOUTME: Service for mapping between HtmlSettingsData and VS Code settings
// ABOUTME: Uses LS_KEY_TO_VSCODE_KEY as single source of truth for key mapping
import { ALLISSUES, NEWISSUES } from '../../../configuration/configuration';
import {
  ADVANCED_CLI_RELEASE_CHANNEL,
  AUTH_METHOD_OAUTH,
  AUTH_METHOD_PAT,
  AUTH_METHOD_TOKEN,
  HTTP_PROXY_STRICT_SSL_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  SEVERITY_FILTER_SETTING,
} from '../../../constants/settings';
import { LS_KEY } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import { LS_KEY_TO_VSCODE_KEY, lsKeyToVscodeKey } from '../../../languageServer/lsKeyToVscodeKeyMap';
import { HtmlSettingsData } from '../types/workspaceConfiguration.types';

export interface IConfigurationMappingService {
  mapConfigToSettings(config: HtmlSettingsData, isCliOnly: boolean): Record<string, unknown>;
  mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined;
}

/** LS keys that need value transformation before writing to VS Code settings. */
const SKIP_IN_LOOP = new Set<string>([
  LS_KEY.proxyInsecure,
  LS_KEY.scanNetNew,
  LS_KEY.scanAutomatic,
  LS_KEY.authenticationMethod,
  LS_KEY.issueViewOpenIssues,
  LS_KEY.issueViewIgnoredIssues,
]);

/** LS keys that belong to the CLI-only fallback form subset. */
const CLI_ONLY_LS_KEYS = new Set<string>([
  LS_KEY.cliPath,
  LS_KEY.automaticDownload,
  LS_KEY.binaryBaseUrl,
  LS_KEY.proxyInsecure,
]);

export class ConfigurationMappingService implements IConfigurationMappingService {
  private readonly authMethodMap: Record<string, string> = {
    oauth: AUTH_METHOD_OAUTH,
    pat: AUTH_METHOD_PAT,
    token: AUTH_METHOD_TOKEN,
  };

  private normalizeAuthenticationMethod(value: string | undefined): string {
    if (!value) return this.authMethodMap.oauth;
    const normalized = value.toLowerCase().trim();
    return this.authMethodMap[normalized] || this.authMethodMap.oauth;
  }

  mapConfigToSettings(config: HtmlSettingsData, isCliOnly: boolean): Record<string, unknown> {
    const configRecord = config as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    // Data-driven: iterate the single LS_KEY_TO_VSCODE_KEY mapping
    for (const [lsKey, vscodeKey] of Object.entries(LS_KEY_TO_VSCODE_KEY)) {
      if (SKIP_IN_LOOP.has(lsKey)) continue;
      if (isCliOnly && !CLI_ONLY_LS_KEYS.has(lsKey)) continue;

      const value = configRecord[lsKey];
      if (value !== undefined) {
        result[vscodeKey] = value;
      }
    }

    // Fields with value transformations
    if (config.proxy_insecure !== undefined) {
      result[HTTP_PROXY_STRICT_SSL_SETTING] = !config.proxy_insecure;
    }

    if (!isCliOnly) {
      result[LS_KEY_TO_VSCODE_KEY[LS_KEY.scanNetNew]] = config.scan_net_new ? NEWISSUES : ALLISSUES;
      result[LS_KEY_TO_VSCODE_KEY[LS_KEY.scanAutomatic]] = config.scan_automatic ? 'auto' : 'manual';
      result[LS_KEY_TO_VSCODE_KEY[LS_KEY.authenticationMethod]] = this.normalizeAuthenticationMethod(
        config.authentication_method,
      );

      // Composite: two LS keys → one VS Code setting
      if (config.issue_view_open_issues !== undefined || config.issue_view_ignored_issues !== undefined) {
        result[ISSUE_VIEW_OPTIONS_SETTING] = {
          openIssues: config.issue_view_open_issues,
          ignoredIssues: config.issue_view_ignored_issues,
        };
      }
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
