import * as vscode from 'vscode';
import { Issue, SecretIssueData } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';

export interface ISecretsSuggestionWebviewProvider extends IWebViewProvider<Issue<SecretIssueData>> {
  openIssueId: string | undefined;
}

export type SecretIssueCommandArg = {
  id: string;
  folderPath: string;
  filePath: string;
  range: vscode.Range;
};
