// ABOUTME: Type definitions for workspace configuration data structures
// ABOUTME: Defines interfaces for config data, issue view options, severity filters, and folder configs

// Configuration data types matching the structure from Language Server HTML
interface IssueViewOptions {
  openIssues?: boolean;
  ignoredIssues?: boolean;
}

interface FilterSeverity {
  critical?: boolean;
  high?: boolean;
  medium?: boolean;
  low?: boolean;
}

type ScanCommandConfig = {
  preScanCommand: string;
  preScanOnlyReferenceFolder: boolean;
  postScanCommand: string;
  postScanOnlyReferenceFolder: boolean;
};

export interface FolderConfigData {
  folderPath: string;
  additionalParameters: string[];
  additionalEnv: string;
  preferredOrg: string;
  autoDeterminedOrg: string;
  orgSetByUser: boolean;
  scanCommandConfig: Record<string, ScanCommandConfig>;
}

export interface IdeConfigData {
  isFallbackForm?: boolean;

  // Scan Settings
  activateSnykOpenSource?: boolean;
  activateSnykCode?: boolean;
  activateSnykIac?: boolean;
  activateSnykSecrets?: boolean;
  scanningMode?: string;
  organization?: string;

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
  setAuthToken(token: string, apiUrl?: string): void;
}

interface SaveConfigMessage {
  type: 'saveConfig';
  config?: string;
}

interface ExecuteCommandMessage {
  type: 'executeCommand';
  command?: string;
  arguments?: unknown[];
  callbackId?: string;
}

export type WebviewMessage = SaveConfigMessage | ExecuteCommandMessage;
