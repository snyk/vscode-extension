import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/interfaces';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
  IacIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | IacIssueCommandArg | OssIssueCommandArg;
  issueType: OpenCommandIssueType;
};
