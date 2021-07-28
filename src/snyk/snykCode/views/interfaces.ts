import { IExtension } from '../../base/modules/interfaces';
import * as vscode from 'vscode';

export interface ISuggestionProvider {
  activate(extension: IExtension): void;
  show(suggestionId: string, uri: vscode.Uri, position: vscode.Range): void;
  checkCurrentSuggestion(): void;
}
