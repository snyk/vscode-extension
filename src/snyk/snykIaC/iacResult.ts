import { IacIssueData, Issue } from '../common/languageServer/types';

export type IacWorkspaceFolderResult = Issue<IacIssueData>[] | Error;
export type IacResult = Map<string, IacWorkspaceFolderResult>; // map of a workspace folder to results array or an error occurred in this folder
