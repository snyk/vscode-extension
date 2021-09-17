export type OssResult = OssFileResult[] | OssFileResult;

export type OssFileResult = {
  vulnerabilities: OssVulnerability[];
  projectName: string;
  displayTargetFile: string;
  packageManager: string;
};

export type OssVulnerability = {
  id: string;
  license?: string;
  identifiers?: Identifiers;
  title: string;
  description: string;
  language: string;
  packageManager: string;
  packageName: string;
  severity: OssSeverity;
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
};

export type Identifiers = {
  CWE: string[];
  CVE: string[];
};

export enum OssSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}
