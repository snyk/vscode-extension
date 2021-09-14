import * as vscode from 'vscode';
import { Disposable, ProgressLocation, WebviewPanelSerializer } from 'vscode';

export interface IVSCodeWindow {
  withProgress<R>(
    progressTitle: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Thenable<R>,
  ): Promise<R>;

  registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): Disposable;
}

/**
 * A wrapper class for the vscode.window to provide centralised access to dealing with the current window of the editor.
 */
export class VSCodeWindow implements IVSCodeWindow {
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
}

export const vsCodeWindow = new VSCodeWindow();
