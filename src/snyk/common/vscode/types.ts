/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type * as vscode from 'vscode';
import type * as lsc from 'vscode-languageclient/node';
import type * as lst from 'vscode-languageserver-textdocument';

// VS Code core type mappings
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
export type HoverProvider = vscode.HoverProvider;
export type TextEditor = vscode.TextEditor;
export type TextDocument = vscode.TextDocument;
export type TextDocumentShowOptions = vscode.TextDocumentShowOptions;
export type TextDocumentContentChangeEvent = vscode.TextDocumentContentChangeEvent;
export type ViewColumn = vscode.ViewColumn;
export type Position = vscode.Position;
export type Range = vscode.Range;
export type SecretStorage = vscode.SecretStorage;
export type SecretStorageChangeEvent = vscode.SecretStorageChangeEvent;
export type Event<T> = vscode.Event<T>;
export type Uri = vscode.Uri;
export type MarkdownString = vscode.MarkdownString;
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

// Language client type mappings
export type LanguageClient = lsc.LanguageClient;
export type LanguageClientOptions = lsc.LanguageClientOptions;
export type ServerOptions = lsc.ServerOptions;
export type Middleware = lsc.Middleware;
export type WorkspaceMiddleware = lsc.WorkspaceMiddleware;
export type ConfigurationParams = lsc.ConfigurationParams;
export type CancellationToken = lsc.CancellationToken;
export type ConfigurationRequestHandlerSignature = lsc.ConfigurationRequest.HandlerSignature;
export type ResponseError<D = void> = lsc.ResponseError<D>;
export type InlineValueText = lsc.InlineValueText;
export type LSPTextDocument = lst.TextDocument;
export type ShowDocumentParams = lsc.ShowDocumentParams;
export type ShowDocumentRequestHandlerSignature = lsc.ShowDocumentRequest.HandlerSignature;
export type ShowDocumentResult = lsc.ShowDocumentResult;
export type WindowMiddleware = lsc.WindowMiddleware;

// Language client namespace mappings
/*
 * TODO - Look into how to map without re-declaring.
 * You can't `export const NS = parent.NS;` as that breaks unit tests, as it causes an import of vscode.
 */
export declare namespace CancellationToken {
  // map of lsc.CancellationToken
  const None: CancellationToken;
  const Cancelled: CancellationToken;
  function is(value: any): value is CancellationToken;
}
