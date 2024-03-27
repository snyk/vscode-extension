import _ from 'lodash';
import { Issue, IssueSeverity, OssIssueData } from '../common/languageServer/types';
import { IWebViewProvider } from '../common/views/webviewProvider';
import { CliError } from '../cli/services/cliService';

export interface IOssSuggestionWebviewProvider extends IWebViewProvider<Issue<OssIssueData>> {
  openIssueId: string | undefined;
}

export type OssIssueCommandArg = Issue<OssIssueData> & {
  matchingIdVulnerabilities: Issue<OssIssueData>[];
  overviewHtml: string;
  folderPath: string;
};

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

type Identifiers = {
  CWE: string[];
  CVE: string[];
};

enum OssSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export function isResultCliError(fileResult: OssFileResult): fileResult is CliError {
  return (fileResult as CliError).error !== undefined;
}

function convertSeverity(severity: IssueSeverity): OssSeverity {
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

  if (issue.additionalData.license !== undefined) {
    tempVuln.license = issue.additionalData.license;
  }

  return tempVuln;
}
