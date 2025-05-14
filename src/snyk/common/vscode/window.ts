import * as vscode from 'vscode';
import {
  CancellationToken,
  Disposable,
  ProgressLocation,
  TextEditorDecorationType,
  WebviewPanelSerializer,
} from 'vscode';
import { InputBoxOptions, TextDocument, TextDocumentShowOptions, TextEditor, Uri, ViewColumn } from './types';

export interface IVSCodeWindow {
  getActiveTextEditor(): vscode.TextEditor | undefined;
  getVisibleTextEditors(): readonly TextEditor[];
  showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Promise<TextEditor>;
  showTextDocumentViaUri(uri: Uri, options?: TextDocumentShowOptions): Thenable<TextEditor>;
  showTextDocumentViaFilepath(filePath: string, options?: TextDocumentShowOptions): Thenable<TextEditor>;
  createOutputChannel(channelName: string): vscode.OutputChannel;
  createTextEditorDecorationType(options: vscode.DecorationRenderOptions): TextEditorDecorationType;

  withProgress<R>(
    progressTitle: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Thenable<R>,
  ): Promise<R>;

  registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): Disposable;

  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;

  showInputBox(options?: InputBoxOptions, token?: CancellationToken): Promise<string | undefined>;

  onDidChangeActiveTextEditor(listener: (e: vscode.TextEditor | undefined) => unknown): vscode.Disposable;

  showOpenDialog(param: {
    canSelectFiles: boolean;
    canSelectFolders: boolean;
    canSelectMany: boolean;
    openLabel: string;
  }): Thenable<Uri[] | undefined>;
}

/**
 * A wrapper class for the vscode.window to provide centralised access to dealing with the current window of the editor.
 */
class VSCodeWindow implements IVSCodeWindow {
  // Map to track recently shown authentication error messages
  private recentAuthErrorMessages = new Map<string, number>();
  // Debounce period for authentication error messages (5 seconds)
  private readonly AUTH_ERROR_DEBOUNCE_MS = 5000;
  showOpenDialog(param: {
    canSelectFiles: boolean;
    canSelectFolders: boolean;
    canSelectMany: boolean;
    openLabel: string;
  }): Thenable<Uri[] | undefined> {
    return vscode.window.showOpenDialog(param);
  }

  getActiveTextEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
  }

  getVisibleTextEditors(): readonly TextEditor[] {
    return vscode.window.visibleTextEditors;
  }

  showTextDocument(document: TextDocument, column?: ViewColumn, preserveFocus?: boolean): Promise<TextEditor> {
    return new Promise((resolve, reject) => {
      vscode.window.showTextDocument(document, column, preserveFocus).then(
        doc => resolve(doc),
        reason => reject(reason),
      );
    });
  }

  showTextDocumentViaUri(uri: Uri, options?: TextDocumentShowOptions): Thenable<TextEditor> {
    return vscode.window.showTextDocument(uri, options);
  }

  showTextDocumentViaFilepath(filePath: string, options?: TextDocumentShowOptions): Thenable<TextEditor> {
    const uri = vscode.Uri.file(filePath);
    return vscode.window.showTextDocument(uri, options);
  }

  createTextEditorDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType(options);
  }

  createOutputChannel(channelName: string): vscode.OutputChannel {
    return vscode.window.createOutputChannel(channelName);
  }

  registerWebviewPanelSerializer(viewType: string, serializer: vscode.WebviewPanelSerializer): vscode.Disposable {
    return vscode.window.registerWebviewPanelSerializer(viewType, serializer);
  }

  withProgress<R>(
    progressTitle: string,
    task: (
      progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined }>,
      token: vscode.CancellationToken,
    ) => Thenable<R>,
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      VSCodeWindow.withProgress(progressTitle, task).then(
        (value: R) => resolve(value),
        reason => reject(reason),
      );
    });
  }

  private static withProgress<R>(
    progressTitle: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Thenable<R>,
  ): Thenable<R> {
    const options = {
      location: ProgressLocation.Notification,
      title: progressTitle,
      cancellable: true,
    };

    return vscode.window.withProgress(options, task);
  }

  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      vscode.window.showInformationMessage(message, ...items).then(
        (value: string | undefined) => resolve(value),
        reason => reject(reason),
      );
    });
  }

  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    if (!message) {
      return Promise.resolve(undefined);
    }

    // Check if this is an authentication error message
    const AUTH_ERROR_KEYWORDS = ['authentication', 'authenticate', 'credentials'];
    const isAuthError = AUTH_ERROR_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));

    if (isAuthError) {
      const now = Date.now();
      const lastShown = this.recentAuthErrorMessages.get(message);

      // If we've shown this message recently, don't show it again
      if (lastShown && now - lastShown < this.AUTH_ERROR_DEBOUNCE_MS) {
        return Promise.resolve(undefined);
      }

      // Update the timestamp for this message
      this.recentAuthErrorMessages.set(message, now);

      // Clean up old messages from the map
      this.cleanupOldAuthErrors(now);
    }

    return new Promise((resolve, reject) => {
      vscode.window.showErrorMessage(message, ...items).then(
        (value: string | undefined) => resolve(value),
        reason => reject(reason),
      );
    });
  }

  /**
   * Clean up authentication error messages that are older than the debounce period
   */
  private cleanupOldAuthErrors(now: number): void {
    for (const [message, timestamp] of this.recentAuthErrorMessages.entries()) {
      if (now - timestamp > this.AUTH_ERROR_DEBOUNCE_MS) {
        this.recentAuthErrorMessages.delete(message);
      }
    }
  }

  showInputBox(options?: InputBoxOptions, token?: CancellationToken): Promise<string | undefined> {
    return vscode.window.showInputBox(options, token) as Promise<string | undefined>;
  }

  onDidChangeActiveTextEditor(listener: (e: vscode.TextEditor | undefined) => unknown): vscode.Disposable {
    return vscode.window.onDidChangeActiveTextEditor(listener);
  }
}

export const vsCodeWindow = new VSCodeWindow();
