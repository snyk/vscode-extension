import _ from 'lodash';
import { CliError } from '../cli/services/cliService';
import { IssueSeverity } from '../common/languageServer/types';

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
