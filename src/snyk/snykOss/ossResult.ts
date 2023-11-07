import _ from 'lodash';
import { CliError } from '../cli/services/cliService';
import { Issue, IssueSeverity, OssIssueData } from '../common/languageServer/types';

export type OssResult = OssFileResult[] | OssFileResult;

export type OssFileResult = OssResultBody | CliError;

export type OssResultBody = {
  vulnerabilities: OssVulnerability[];
  projectName: string;
  displayTargetFile: string;
  packageManager: string;
  path: string;
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

export function capitalizeOssSeverity(ossSeverity: OssSeverity): Capitalize<OssSeverity> {
  return _.capitalize(ossSeverity) as Capitalize<OssSeverity>;
}

export function isResultCliError(fileResult: OssFileResult): fileResult is CliError {
  return (fileResult as CliError).error !== undefined;
}

export function convertSeverity(severity: IssueSeverity): OssSeverity {
  switch (severity) {
    case IssueSeverity.Low:
      return OssSeverity.Low;
    case IssueSeverity.Medium:
      return OssSeverity.Medium;
    case IssueSeverity.High:
      return OssSeverity.High;
    default:
      return OssSeverity.Critical;
  }
}

export function convertIssue(issue: Issue<OssIssueData>): OssVulnerability {
  const tempVuln: OssVulnerability = {
    id: issue.id,
    license: issue.additionalData.license,
    identifiers: issue.additionalData.identifiers,
    title: issue.title,
    description: issue.additionalData.description,
    language: issue.additionalData.language,
    packageManager: issue.additionalData.packageManager,
    packageName: issue.additionalData.packageName,
    severity: convertSeverity(issue.severity),
    name: issue.additionalData.name,
    version: issue.additionalData.version,
    exploit: issue.additionalData.exploit,

    CVSSv3: issue.additionalData.CVSSv3,
    cvssScore: issue.additionalData.cvssScore,

    fixedIn: issue.additionalData.fixedIn === undefined ? [] : issue.additionalData.fixedIn,
    from: issue.additionalData.from,
    upgradePath: issue.additionalData.upgradePath,
    isPatchable: issue.additionalData.isPatchable,
    isUpgradable: issue.additionalData.isUpgradable,
  };
  return tempVuln;
}
