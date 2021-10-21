import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | OssIssueCommandArg;
  issueType: OpenCommandIssueType;
};
