import * as vscode from 'vscode';

export type Disposable = vscode.Disposable;
export type DiagnosticCollection = vscode.DiagnosticCollection;
export type Diagnostic = vscode.Diagnostic;
export type DiagnosticRelatedInformation = vscode.DiagnosticRelatedInformation;
export enum DiagnosticSeverity { // map of vscode.DiagnosticSeverity
  Hint = 3,
  Information = 2,
  Warning = 1,
  Error = 0,
}

export type DocumentSelector = vscode.DocumentSelector;
export type DocumentFilter = vscode.DocumentFilter;
export type HoverProvider = vscode.HoverProvider;
export type ProviderResult<T> = vscode.ProviderResult<T>;
export type TextEditor = vscode.TextEditor;
export type TextDocument = vscode.TextDocument;
export type ViewColumn = vscode.ViewColumn;
export type Position = vscode.Position;
export type Range = vscode.Range;
export type Selection = vscode.Selection;
export type SecretStorage = vscode.SecretStorage;
export type SecretStorageChangeEvent = vscode.SecretStorageChangeEvent;
export type Event<T> = vscode.Event<T>;
export type Uri = vscode.Uri;
export type MarkedString = vscode.MarkedString;
export type MarkdownString = vscode.MarkdownString;
export type Hover = vscode.Hover;
export type CodeAction = vscode.CodeAction;
export type CodeActionKind = vscode.CodeActionKind;
export type CodeActionProvider = vscode.CodeActionProvider;
export type CodeActionContext = vscode.CodeActionContext;
export type Command = vscode.Command;
export type TextEditorDecorationType = vscode.TextEditorDecorationType;
export type DecorationOptions = vscode.DecorationOptions;
export type ThemeColor = vscode.ThemeColor;
export type ThemableDecorationInstanceRenderOptions = vscode.ThemableDecorationInstanceRenderOptions;
export type CodeActionProviderMetadata = vscode.CodeActionProviderMetadata;
export type ExtensionContext = vscode.ExtensionContext;
export type WebviewOptions = vscode.WebviewOptions;
export type TextDocumentChangeEvent = vscode.TextDocumentChangeEvent;
export type InputBoxOptions = vscode.InputBoxOptions;
