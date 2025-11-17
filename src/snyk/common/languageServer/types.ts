import { Range } from 'vscode-languageserver-types';

export enum ScanProduct {
  Code = 'code',
  OpenSource = 'oss',
  InfrastructureAsCode = 'iac',
}

export enum LsScanProduct {
  Code = 'Snyk Code',
  OpenSource = 'Snyk Open Source',
  InfrastructureAsCode = 'Snyk IaC',
  Unknown = '',
}

export enum ScanStatus {
  InProgress = 'inProgress',
  Success = 'success',
  Error = 'error',
}

export type PresentableError = {
  code?: number;
  error?: string;
  path?: string;
  command?: string;
  showNotification: boolean;
  treeNodeSuffix: string;
};

export function isPresentableError(result: unknown): result is PresentableError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    'treeNodeSuffix' in result &&
    !Array.isArray(result)
  );
}

export type Scan = {
  folderPath: string;
  product: ScanProduct;
  status: ScanStatus;
  presentableError?: PresentableError;
};

export type Issue<T> = {
  id: string;
  title: string;
  severity: IssueSeverity;
  filePath: string;
  contentRoot: string;
  range: Range;
  isIgnored: boolean;
  isNew: boolean;
  filterableIssueType: string;
  additionalData: T;
};

export enum IssueSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

// Snyk Code
export type CodeIssueData = {
  message: string;
  leadURL?: string;
  rule: string;
  ruleId: string;
  repoDatasetSize: number;
  exampleCommitFixes: ExampleCommitFix[];
  cwe: string[];
  text: string;
  markers?: Marker[];
  cols: Point;
  rows: Point;
  isSecurityType: boolean;
  priorityScore: number;
  hasAIFix: boolean;
  details: string; // HTML from the LSP
};

export type ExampleCommitFix = {
  commitURL: string;
  lines: CommitChangeLine[];
};
type CommitChangeLine = {
  line: string;
  lineNumber: number;
  lineChange: 'removed' | 'added' | 'none';
  isExampleLineEncoded?: boolean;
};
export type Marker = {
  msg: Point;
  pos: MarkerPosition[];
};
type MarkerPosition = Position & {
  file: string;
};
type Position = {
  cols: Point;
  rows: Point;
};
export type Point = [number, number];

// Snyk Open Source
export type OssIssueData = {
  license?: string;
  identifiers?: Identifiers; // may be common?
  description: string; // may be common?
  language: string;
  packageManager: string;
  packageName: string;
  name: string;
  version: string;
  exploit?: string;

  CVSSv3?: string;
  cvssScore?: number;

  fixedIn?: Array<string>;
  from: Array<string>;
  upgradePath: Array<string>;
  isPatchable: boolean;
  isUpgradable: boolean;

  projectName: string;
  displayTargetFile: string;

  details: string;
};
type Identifiers = {
  CWE: string[];
  CVE: string[];
};

// Snyk Infrastructure as Code
export type IacIssueData = {
  publicId: string;
  documentation: string;
  lineNumber: number;
  issue: string;
  impact: string;
  path?: string[];
  resolve?: string;
  references?: string[];
  customUIContent: string;
};

export type AutofixUnifiedDiffSuggestion = {
  fixId: string;
  unifiedDiffsPerFile: { [key: string]: string };
};

export type Summary = {
  toggleDelta: boolean;
};

export type SummaryMessage = {
  type: string;
  args: {
    summary: Summary;
  };
};

export enum SnykURIAction {
  ShowInDetailPanel = 'showInDetailPanel',
}

export type ShowIssueDetailTopicParams = {
  issueId: string;
  product: LsScanProduct;
};
