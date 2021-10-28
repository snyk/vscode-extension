import * as vscode from 'vscode';
import { CodeAction, CodeActionKind } from './types';

export interface ICodeActionAdapter {
  create(title: string, kind?: CodeActionKind): CodeAction;
}

export class CodeActionAdapter implements ICodeActionAdapter {
  create(title: string, kind?: CodeActionKind): CodeAction {
    return new vscode.CodeAction(title, kind);
  }
}

export interface ICodeActionKindAdapter {
  getQuickFix(): CodeActionKind;
}

export class CodeActionKindAdapter implements ICodeActionKindAdapter {
  getQuickFix(): CodeActionKind {
    return vscode.CodeActionKind.QuickFix;
  }
}
