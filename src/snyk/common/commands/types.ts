import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/interfaces';
import { SecretIssueCommandArg } from '../../snykSecrets/views/interfaces';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
  IacIssue,
  SecretsIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | IacIssueCommandArg | OssIssueCommandArg | SecretIssueCommandArg;
  issueType: OpenCommandIssueType;
};
