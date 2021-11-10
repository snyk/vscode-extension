import * as vscode from 'vscode';
import { Disposable, ProgressLocation, TextEditorDecorationType, WebviewPanelSerializer } from 'vscode';
import { TextEditor } from './types';

export interface IVSCodeWindow {
  getActiveTextEditor(): vscode.TextEditor | undefined;
  getVisibleTextEditors(): TextEditor[];
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

  onDidChangeActiveTextEditor(listener: (e: vscode.TextEditor | undefined) => unknown): vscode.Disposable;
}

/**
 * A wrapper class for the vscode.window to provide centralised access to dealing with the current window of the editor.
 */
export class VSCodeWindow implements IVSCodeWindow {
  getActiveTextEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
  }

  getVisibleTextEditors(): TextEditor[] {
    return vscode.window.visibleTextEditors;
  }

  createTextEditorDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType(options);
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
    return new Promise((resolve, reject) => {
      vscode.window.showErrorMessage(message, ...items).then(
        (value: string | undefined) => resolve(value),
        reason => reject(reason),
      );
    });
  }

  onDidChangeActiveTextEditor(listener: (e: vscode.TextEditor | undefined) => unknown): vscode.Disposable {
    return vscode.window.onDidChangeActiveTextEditor(listener);
  }
}

export const vsCodeWindow = new VSCodeWindow();
