import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { CodeIssueCommandArg, CodeIssueCommandArgOld } from '../../snykCode/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';

export enum OpenCommandIssueType {
  CodeIssueOld,
  CodeIssue,
  OssVulnerability,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | CodeIssueCommandArgOld | OssIssueCommandArg;
  issueType: OpenCommandIssueType;
};

export type ReportFalsePositiveCommandArg = {
  suggestion: Readonly<completeFileSuggestionType>;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is completeFileSuggestionType => {
  return issueType === OpenCommandIssueType.CodeIssueOld;
};

export const isOssIssue = (
  _issue: completeFileSuggestionType | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is OssIssueCommandArg => {
  return issueType === OpenCommandIssueType.OssVulnerability;
};
