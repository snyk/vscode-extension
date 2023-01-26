import * as vscode from 'vscode';
import { IWebViewProvider } from '../../common/views/webviewProvider';
import { completeFileSuggestionType } from '../interfaces';

export interface ICodeSuggestionWebviewProvider extends IWebViewProvider<completeFileSuggestionType> {
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}

export type CodeIssueCommandArgOld = {
  message: string;
  filePath: vscode.Uri;
  range: vscode.Range;
  diagnostic: vscode.Diagnostic;
};

export type CodeIssueCommandArg = {
  id: string;
  folderPath: string;
  filePath: string;
  range: vscode.Range;
};
