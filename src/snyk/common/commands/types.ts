import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArgLanguageServer } from '../../snykOss/interfaces';
import { CodeIssueData, Issue } from '../languageServer/types';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
  IacIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | IacIssueCommandArg | OssIssueCommandArgLanguageServer;
  issueType: OpenCommandIssueType;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArgLanguageServer,
  issueType: OpenCommandIssueType,
): _issue is Issue<CodeIssueData> => {
  return issueType === OpenCommandIssueType.CodeIssue;
};
