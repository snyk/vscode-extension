import { completeFileSuggestionType } from '../../snykCode/interfaces';
import { CodeIssueCommandArg } from '../../snykCode/views/interfaces';
import { IacIssueCommandArg } from '../../snykIac/views/interfaces';
import { OssIssueCommandArg } from '../../snykOss/interfaces';
import { CodeIssueData, Issue } from '../languageServer/types';

export enum OpenCommandIssueType {
  CodeIssue,
  OssVulnerability,
  IacIssue,
}

export type OpenIssueCommandArg = {
  issue: CodeIssueCommandArg | IacIssueCommandArg | OssIssueCommandArg;
  issueType: OpenCommandIssueType;
};

export const isCodeIssue = (
  _issue: completeFileSuggestionType | Issue<CodeIssueData> | OssIssueCommandArg,
  issueType: OpenCommandIssueType,
): _issue is Issue<CodeIssueData> => {
  return issueType === OpenCommandIssueType.CodeIssue;
};
