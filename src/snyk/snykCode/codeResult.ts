import { CodeIssueData, Issue } from '../common/languageServer/types';

export type CodeWorkspaceFolderResult = Issue<CodeIssueData>[] | Error;
export type CodeResult = Map<string, CodeWorkspaceFolderResult>; // map of a workspace folder to results array or an error occurred in this folder
