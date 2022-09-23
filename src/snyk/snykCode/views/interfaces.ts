import * as vscode from 'vscode';
import { IWebViewProvider } from '../../common/views/webviewProvider';
import { completeFileSuggestionType } from '../interfaces';

export interface ICodeSuggestionWebviewProvider extends IWebViewProvider<completeFileSuggestionType> {
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}

export type CodeIssueCommandArg = {
  message: string;
  uri: vscode.Uri;
  range: vscode.Range;
  openUri?: vscode.Uri;
  openRange?: vscode.Range;
  diagnostic: vscode.Diagnostic;
};
