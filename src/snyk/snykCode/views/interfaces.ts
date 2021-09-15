import { IExtension } from '../../base/modules/interfaces';
import * as vscode from 'vscode';

export interface ICodeSuggestionWebviewProvider {
  activate(extension: IExtension): void;
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}

export type CodeIssueCommandArg = {
  message: string;
  uri: vscode.Uri;
  range: vscode.Range;
  openUri?: vscode.Uri;
  openRange?: vscode.Range;
};
