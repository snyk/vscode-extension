import * as vscode from 'vscode';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';

export interface ICodeSuggestionWebviewProvider extends IWebViewProvider<Issue<CodeIssueData>> {
  openIssueId: string | undefined;
}

export type CodeIssueCommandArg = {
  id: string;
  folderPath: string;
  filePath: string;
  range: vscode.Range;
};
