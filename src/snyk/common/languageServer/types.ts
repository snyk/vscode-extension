export enum ScanProduct {
  Code = 'code',
  OpenSource = 'oss',
  InfrastructureAsCode = 'iac',
}

export type InProgress = 'inProgress';
export enum ScanStatus {
  InProgress = 'inProgress',
  Success = 'success',
  Error = 'error',
}

export type Scan<T> = {
  folderPath: string;
  product: ScanProduct;
  status: ScanStatus;
  issues: Issue<T>[];
};

export type Issue<T> = {
  id: string;
  title: string;
  severity: IssueSeverity;
  additionalData: T;
};

export enum IssueSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// Snyk Code
export type CodeIssueData = {
  filePath: string;
  message: string;
  leadURL?: string;
  rule: string;
  repoDatasetSize: number;
  exampleCommitFixes: ExampleCommitFix[];
  cwe: string[];
  text: string;

  markers?: Marker[];
  cols: Point;
  rows: Point;
  isSecurityType: boolean;
};

type ExampleCommitFix = {
  commitURL: string;
  lines: CommitChangeLine[];
};
type CommitChangeLine = {
  line: string;
  lineNumber: number;
  lineChange: 'removed' | 'added' | 'none';
};
type Marker = {
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
type Point = [number, number];

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
};
export type Identifiers = {
  CWE: string[];
  CVE: string[];
};
