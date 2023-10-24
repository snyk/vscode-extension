import * as vscode from 'vscode';
import { OssIssueData, Issue } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';

export interface IOssSuggestionWebviewProvider extends IWebViewProvider<Issue<OssIssueData>> {
  openIssueId: string | undefined;
}

export type OssIssueCommandArg = {
  id?: string;
  folderPath?: string;
  filePath?: string;
  range?: vscode.Range;
};
