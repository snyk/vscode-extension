// ABOUTME: Type definitions for workspace configuration data structures
// ABOUTME: Defines interfaces for config data, issue view options, severity filters, and folder configs

export interface IssueViewOptions {
  openIssues?: boolean;
  ignoredIssues?: boolean;
}

export interface FilterSeverity {
  critical?: boolean;
  high?: boolean;
  medium?: boolean;
  low?: boolean;
}

export type ScanCommandConfig = {
  preScanCommand: string;
  preScanOnlyReferenceFolder: boolean;
  postScanCommand: string;
  postScanOnlyReferenceFolder: boolean;
};

/**
 * Folder-level settings received from the HTML settings form.
 * Field names are LS key strings (snake_case) so they map directly to the LS protocol.
 */
export interface HtmlFolderSettingsData {
  folderPath: string;
  additional_parameters?: string[];
  additional_environment?: string;
  preferred_org?: string;
  auto_determined_org?: string;
  org_set_by_user?: boolean;
  scan_command_config?: Record<string, ScanCommandConfig>;
}

/**
 * HTML settings form data contract.
 * Field names are LS key strings (snake_case) — access as `config.snyk_oss_enabled`.
 * The single mapping from LS keys to VS Code settings lives in {@link LS_KEY_TO_VSCODE_KEY}.
 */
export interface HtmlSettingsData {
  // IDE-only (not LS keys)
  isFallbackForm?: boolean;
  cli_release_channel?: string;
  folderConfigs?: HtmlFolderSettingsData[];

  // LS-keyed settings — field names match LS_KEY values
  snyk_oss_enabled?: boolean;
  snyk_code_enabled?: boolean;
  snyk_iac_enabled?: boolean;
  snyk_secrets_enabled?: boolean;
  scan_automatic?: boolean;
  organization?: string;
  scan_net_new?: boolean;
  authentication_method?: string;
  api_endpoint?: string;
  token?: string;
  proxy_insecure?: boolean;
  trusted_folders?: string[];
  cli_path?: string;
  automatic_download?: boolean;
  binary_base_url?: string;
  enabled_severities?: FilterSeverity;
  risk_score_threshold?: number;
  issue_view_open_issues?: boolean;
  issue_view_ignored_issues?: boolean;
}

export interface IWorkspaceConfigurationWebviewProvider {
  showPanel(): Promise<void>;
  disposePanel(): void;
  setAuthToken(token: string, apiUrl?: string): void;
}

export interface SaveConfigMessage {
  type: 'saveConfig';
  config?: string;
}

export interface ExecuteCommandMessage {
  type: 'executeCommand';
  command?: string;
  arguments?: unknown[];
  callbackId?: string;
}

export type WebviewMessage = SaveConfigMessage | ExecuteCommandMessage;
