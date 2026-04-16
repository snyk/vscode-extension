import type { IConfiguration } from '../configuration/configuration';
import { ALLISSUES, NEWISSUES } from '../configuration/configuration';
import type { LspConfigSetting } from './types';
import {
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_PATH,
  ADVANCED_CLI_RELEASE_CHANNEL,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_ORGANIZATION,
  AUTH_METHOD_OAUTH,
  AUTH_METHOD_PAT,
  AUTH_METHOD_TOKEN,
  AUTO_CONFIGURE_MCP_SERVER,
  CODE_SECURITY_ENABLED_SETTING,
  DELTA_FINDINGS,
  HTTP_PROXY_STRICT_SSL_SETTING,
  IAC_ENABLED_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  OSS_ENABLED_SETTING,
  RISK_SCORE_THRESHOLD_SETTING,
  SCANNING_MODE,
  SECRETS_ENABLED_SETTING,
  SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
} from '../constants/settings';
import { type GlobalLsKeyValue, LS_GLOBAL_KEY, LS_KEY } from './serverSettingsToLspConfigurationParam';

// ── Registry entry type ──────────────────────────────────────────────

export interface RegistryEntry {
  /** VS Code setting key. undefined for LS-only settings (token, sendErrorReports, etc). */
  vscodeKey?: string;
  /** Extracts the outbound LS value from IConfiguration. May be async. */
  resolve: (config: IConfiguration) => unknown | Promise<unknown>;
  /** Converts an inbound LS value to the VS Code setting value. Identity when omitted. */
  toVscodeValue?: (lsValue: unknown) => unknown;
  /** Hardcoded constant — always emitted with `changed: true`. */
  alwaysChanged?: true;
  /** Included in CLI-only fallback form subset. */
  cliOnly?: true;
}

// ── Auth method normalisation ────────────────────────────────────────

const AUTH_METHOD_MAP: Record<string, string> = {
  oauth: AUTH_METHOD_OAUTH,
  pat: AUTH_METHOD_PAT,
  token: AUTH_METHOD_TOKEN,
};

// ── Settings registry ────────────────────────────────────────────────
// Single source of truth for LS key → VS Code key → IConfiguration resolver.
// Typed as Record<GlobalLsKeyValue, …> so a new LS_GLOBAL_KEY without a
// registry entry causes a compile error.

export const SETTINGS_REGISTRY: Record<GlobalLsKeyValue, RegistryEntry> = {
  // Feature toggles — default to true when undefined
  [LS_GLOBAL_KEY.snykCodeEnabled]: {
    vscodeKey: CODE_SECURITY_ENABLED_SETTING,
    resolve: c => c.getFeaturesConfiguration()?.codeSecurityEnabled ?? true,
  },
  [LS_GLOBAL_KEY.snykOssEnabled]: {
    vscodeKey: OSS_ENABLED_SETTING,
    resolve: c => c.getFeaturesConfiguration()?.ossEnabled ?? true,
  },
  [LS_GLOBAL_KEY.snykIacEnabled]: {
    vscodeKey: IAC_ENABLED_SETTING,
    resolve: c => c.getFeaturesConfiguration()?.iacEnabled ?? true,
  },
  [LS_GLOBAL_KEY.snykSecretsEnabled]: {
    vscodeKey: SECRETS_ENABLED_SETTING,
    resolve: c => c.getFeaturesConfiguration()?.secretsEnabled ?? true,
  },

  [LS_GLOBAL_KEY.scanNetNew]: {
    vscodeKey: DELTA_FINDINGS,
    resolve: c => c.getDeltaFindingsEnabled(),
    toVscodeValue: v => (v ? NEWISSUES : ALLISSUES),
  },
  [LS_GLOBAL_KEY.sendErrorReports]: {
    resolve: c => c.shouldReportErrors,
  },
  [LS_GLOBAL_KEY.automaticDownload]: {
    vscodeKey: ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
    resolve: c => c.isAutomaticDependencyManagementEnabled(),
    cliOnly: true,
  },
  [LS_GLOBAL_KEY.proxyInsecure]: {
    vscodeKey: HTTP_PROXY_STRICT_SSL_SETTING,
    resolve: c => c.getInsecure(),
    toVscodeValue: v => !v,
    cliOnly: true,
  },
  [LS_GLOBAL_KEY.enableSnykOssQuickFixActions]: {
    resolve: c => c.getOssQuickFixCodeActionsEnabled(),
  },
  [LS_GLOBAL_KEY.autoConfigureMcpServer]: {
    vscodeKey: AUTO_CONFIGURE_MCP_SERVER,
    resolve: c => c.getAutoConfigureMcpServer(),
  },

  // Always-changed (hardcoded, not user-configurable)
  [LS_GLOBAL_KEY.trustEnabled]: {
    resolve: () => true,
    alwaysChanged: true,
  },
  [LS_GLOBAL_KEY.automaticAuthentication]: {
    resolve: () => false,
    alwaysChanged: true,
  },
  [LS_GLOBAL_KEY.hoverVerbosity]: {
    resolve: () => 1,
    alwaysChanged: true,
  },

  [LS_GLOBAL_KEY.apiEndpoint]: {
    vscodeKey: ADVANCED_CUSTOM_ENDPOINT,
    resolve: c => c.snykApiEndpoint,
  },
  [LS_GLOBAL_KEY.binaryBaseUrl]: {
    vscodeKey: ADVANCED_CLI_BASE_DOWNLOAD_URL,
    resolve: c => c.getCliBaseDownloadUrl(),
    cliOnly: true,
  },
  [LS_GLOBAL_KEY.cliPath]: {
    vscodeKey: ADVANCED_CLI_PATH,
    resolve: c => c.getCliPath(),
    cliOnly: true,
  },
  [LS_GLOBAL_KEY.token]: {
    resolve: c => c.getToken(),
  },
  [LS_GLOBAL_KEY.organization]: {
    vscodeKey: ADVANCED_ORGANIZATION,
    resolve: c => c.organization,
  },
  [LS_GLOBAL_KEY.authenticationMethod]: {
    vscodeKey: ADVANCED_AUTHENTICATION_METHOD,
    resolve: c => c.getAuthenticationMethod(),
    toVscodeValue: v => {
      if (!v || typeof v !== 'string') return AUTH_METHOD_MAP.oauth;
      const normalized = v.toLowerCase().trim();
      return AUTH_METHOD_MAP[normalized] || AUTH_METHOD_MAP.oauth;
    },
  },
  [LS_GLOBAL_KEY.additionalParameters]: {
    vscodeKey: ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
    resolve: c => c.getAdditionalCliParameters(),
  },
  [LS_GLOBAL_KEY.secureAtInceptionExecutionFreq]: {
    vscodeKey: SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
    resolve: c => c.getSecureAtInceptionExecutionFrequency(),
  },

  [LS_GLOBAL_KEY.scanAutomatic]: {
    vscodeKey: SCANNING_MODE,
    resolve: c => {
      const mode = c.scanningMode;
      return mode !== undefined && mode !== '' ? mode !== 'manual' : undefined;
    },
    toVscodeValue: v => (v ? 'auto' : 'manual'),
  },
  [LS_GLOBAL_KEY.severityFilterCritical]: {
    vscodeKey: SEVERITY_FILTER_SETTING,
    resolve: c => c.severityFilter?.critical ?? true,
    toVscodeValue: c => ({ critical: c }),
  },
  [LS_GLOBAL_KEY.severityFilterHigh]: {
    vscodeKey: SEVERITY_FILTER_SETTING,
    resolve: c => c.severityFilter?.high ?? true,
    toVscodeValue: c => ({ high: c }),
  },
  [LS_GLOBAL_KEY.severityFilterMedium]: {
    vscodeKey: SEVERITY_FILTER_SETTING,
    resolve: c => c.severityFilter?.medium ?? true,
    toVscodeValue: c => ({ medium: c }),
  },
  [LS_GLOBAL_KEY.severityFilterLow]: {
    vscodeKey: SEVERITY_FILTER_SETTING,
    resolve: c => c.severityFilter?.low ?? true,
    toVscodeValue: c => ({ low: c }),
  },
  [LS_GLOBAL_KEY.issueViewOpenIssues]: {
    vscodeKey: ISSUE_VIEW_OPTIONS_SETTING,
    resolve: c => c.issueViewOptions?.openIssues,
    toVscodeValue: v => ({ openIssues: v }),
  },
  [LS_GLOBAL_KEY.issueViewIgnoredIssues]: {
    vscodeKey: ISSUE_VIEW_OPTIONS_SETTING,
    resolve: c => c.issueViewOptions?.ignoredIssues,
    toVscodeValue: v => ({ ignoredIssues: v }),
  },
  [LS_GLOBAL_KEY.riskScoreThreshold]: {
    vscodeKey: RISK_SCORE_THRESHOLD_SETTING,
    resolve: c => c.riskScoreThreshold ?? undefined,
  },

  [LS_GLOBAL_KEY.trustedFolders]: {
    vscodeKey: TRUSTED_FOLDERS,
    resolve: c => c.getTrustedFolders(),
    alwaysChanged: true,
  },
};

// ── Derived maps ─────────────────────────────────────────────────────

/** LS key → VS Code setting key (only entries with vscodeKey). */
export const LS_KEY_TO_VSCODE_KEY: Readonly<Record<string, string>> = (() => {
  const map: Record<string, string> = {};
  for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
    if (entry.vscodeKey) {
      map[lsKey] = entry.vscodeKey;
    }
  }
  return map;
})();

/** Reverse index: VS Code setting key → LS keys that map to it. */
export const VSCODE_KEY_TO_LS_KEYS: Readonly<Record<string, string[]>> = (() => {
  const reverse: Record<string, string[]> = {};
  for (const [lsKey, vscodeKey] of Object.entries(LS_KEY_TO_VSCODE_KEY)) {
    (reverse[vscodeKey] ??= []).push(lsKey);
  }
  return reverse;
})();

export function lsKeyToVscodeKey(lsKey: string): string | undefined {
  return LS_KEY_TO_VSCODE_KEY[lsKey];
}

// ── Inbound: LS values → VS Code settings ────────────────────────────

/** Merges object values when multiple LS keys share one vscodeKey (e.g. issueViewOptions). */
function setOrMerge(result: Record<string, unknown>, vscodeKey: string, transformed: unknown): void {
  const existing = result[vscodeKey];
  if (existing !== undefined && typeof existing === 'object' && typeof transformed === 'object') {
    result[vscodeKey] = { ...(existing as Record<string, unknown>), ...(transformed as Record<string, unknown>) };
  } else {
    result[vscodeKey] = transformed;
  }
}

/**
 * Maps webview form data (LS-format keys and values) → VS Code settings.
 * Used when user saves the workspace configuration form.
 */
export function mapConfigToSettings(config: Record<string, unknown>, isCliOnly: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
    if (!entry.vscodeKey) continue;
    if (isCliOnly && !entry.cliOnly) continue;

    const value = config[lsKey];
    if (value === undefined) continue;

    setOrMerge(result, entry.vscodeKey, entry.toVscodeValue ? entry.toVscodeValue(value) : value);
  }

  // IDE-only field (not an LS key, only present in webview form)
  if (config.cli_release_channel !== undefined) {
    result[ADVANCED_CLI_RELEASE_CHANNEL] = config.cli_release_channel;
  }

  return result;
}

/**
 * Maps inbound LS global settings directly to VS Code settings.
 * Entries without a vscodeKey (token, sendErrorReports, etc.) are skipped.
 */
export function mapLspSettingsToVscodeSettings(
  globalSettings: Record<string, LspConfigSetting>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [lsKey, entry] of Object.entries(SETTINGS_REGISTRY)) {
    if (!entry.vscodeKey) continue;

    const value = globalSettings[lsKey]?.value;
    if (value === undefined) continue;

    setOrMerge(result, entry.vscodeKey, entry.toVscodeValue ? entry.toVscodeValue(value) : value);
  }

  return result;
}

/**
 * Maps an HTML/webview setting key to its VS Code setting key.
 * Handles severity sub-keys and legacy camelCase.
 */
export function mapHtmlKeyToVSCodeSetting(htmlKey: string): string | undefined {
  return lsKeyToVscodeKey(htmlKey);
}
