import * as vscode from 'vscode';
import { IacIssueData, Issue } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';

export interface IIacSuggestionWebviewProvider extends IWebViewProvider<Issue<IacIssueData>> {
  openIssueId: string | undefined;
}

export type IacIssueCommandArg = {
  id: string;
  folderPath: string;
  filePath: string;
  range: vscode.Range;
};
