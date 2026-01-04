// ABOUTME: Type definitions for workspace configuration data structures
// ABOUTME: Defines interfaces for config data, issue view options, severity filters, and folder configs

// Configuration data types matching the structure from Language Server HTML
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

export interface FolderConfigData {
  folderPath: string;
  additionalParameters?: string;
  additionalEnv?: string;
  preferredOrg?: string;
  autoDeterminedOrg?: string;
  orgSetByUser?: boolean;
  scanCommandConfig?: Record<string, unknown>;
}

export interface IdeConfigData {
  isFallbackForm?: boolean;

  // Scan Settings
  activateSnykOpenSource?: boolean;
  activateSnykCode?: boolean;
  activateSnykIac?: boolean;
  scanningMode?: string;

  // Issue View Settings
  issueViewOptions?: IssueViewOptions;
  enableDeltaFindings?: boolean;

  // Authentication Settings
  authenticationMethod?: string;

  // Connection Settings
  endpoint?: string;
  token?: string;
  insecure?: boolean;

  // Trusted Folders
  trustedFolders?: string[];

  // CLI Settings
  cliPath?: string;
  manageBinariesAutomatically?: boolean;
  cliBaseDownloadURL?: string;
  cliReleaseChannel?: string;

  // Filter Settings
  filterSeverity?: FilterSeverity;
  riskScoreThreshold?: number;

  // Folder Configs
  folderConfigs?: FolderConfigData[];
}

export interface IWorkspaceConfigurationWebviewProvider {
  showPanel(): Promise<void>;
  disposePanel(): void;
  setAuthToken(token: string): void;
}

export interface WebviewMessage {
  type: string;
  config?: string;
}
