import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArgLanguageServer } from '../../snykOss/interfaces';
import { OssIssueCommandArg } from '../../snykOss/views/ossVulnerabilityTreeProvider';
import { CodeIssueData, Issue } from '../languageServer/types';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
  IacIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | OssIssueCommandArg | IacIssueCommandArg | OssIssueCommandArgLanguageServer;
  issueType: OpenCommandIssueType;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg | OssIssueCommandArgLanguageServer,
  issueType: OpenCommandIssueType,
): _issue is Issue<CodeIssueData> => {
  return issueType === OpenCommandIssueType.CodeIssue;
};

export const isOssIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg | OssIssueCommandArgLanguageServer,
  issueType: OpenCommandIssueType,
): _issue is OssIssueCommandArg => {
  return issueType === OpenCommandIssueType.OssVulnerability;
};
