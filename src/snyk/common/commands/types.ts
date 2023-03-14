import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { CodeIssueCommandArg, CodeIssueCommandArgOld } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { CodeIssueData, Issue } from '../languageServer/types';

export enum OpenCommandIssueType {
  CodeIssueOld,
  CodeIssue,
  OssVulnerability,
  IacIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | CodeIssueCommandArgOld | OssIssueCommandArg | IacIssueCommandArg;
  issueType: OpenCommandIssueType;
};

export type ReportFalsePositiveCommandArg = {
  suggestion: Readonly<completeFileSuggestionType>;
};

export const isCodeIssueOld = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is completeFileSuggestionType => {
  return issueType === OpenCommandIssueType.CodeIssueOld;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is Issue<CodeIssueData> => {
  return issueType === OpenCommandIssueType.CodeIssue;
};

export const isOssIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is OssIssueCommandArg => {
  return issueType === OpenCommandIssueType.OssVulnerability;
};
