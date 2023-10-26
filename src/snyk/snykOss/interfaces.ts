import * as vscode from 'vscode';
import { Issue, OssIssueData } from '../common/languageServer/types';
import { IWebViewProvider } from '../common/views/webviewProvider';

export interface IOssSuggestionWebviewProvider extends IWebViewProvider<Issue<OssIssueData>> {
  openIssueId: string | undefined;
}

export type OssIssueCommandArgLanguageServer = {
  id: string;
  folderPath: string;
  filePath: string;
  range: vscode.Range | undefined;
};
