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

export enum LsErrorMessage {
  repositoryInvalidError = 'repository does not exist',
}

export type Scan<T> = {
  folderPath: string;
  product: ScanProduct;
  status: ScanStatus;
  issues: Issue<T>[];
  errorMessage: string;
};

export type Issue<T> = {
  id: string;
  title: string;
  severity: IssueSeverity;
  filePath: string;
  additionalData: T;
  isIgnored: boolean;
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
  cvssScore?: string;

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
