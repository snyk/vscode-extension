import * as vscode from 'vscode';
import { CodeIssueData, Issue } from '../../common/languageServer/types';
import { IWebViewProvider } from '../../common/views/webviewProvider';
import { completeFileSuggestionType } from '../interfaces';

export interface ICodeSuggestionWebviewProviderOld extends IWebViewProvider<completeFileSuggestionType> {
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}

export interface ICodeSuggestionWebviewProvider extends IWebViewProvider<Issue<CodeIssueData>> {
  show(folderPath: string, issueId: string): void;
  disposePanelIfStale(): void;
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
