import { completeFileSuggestionType } from '../../snykCode/interfaces';
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

export type ReportFalsePositiveCommandArg = {
  suggestion: Readonly<completeFileSuggestionType>;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is completeFileSuggestionType => {
  return issueType === OpenCommandIssueType.CodeIssue;
};

export const isOssIssue = (
  _issue: completeFileSuggestionType | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is OssIssueCommandArg => {
  return issueType === OpenCommandIssueType.OssVulnerability;
};
