import * as vscode from 'vscode';
import { Disposable, DocumentSelector, HoverProvider } from './types';

export interface IVSCodeLanguages {
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;
}

export class VSCodeLanguages implements IVSCodeLanguages {
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
    return vscode.languages.registerHoverProvider(selector, provider);
  }
}

export const vsCodeLanguages = new VSCodeLanguages();
