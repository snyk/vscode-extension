import * as vscode from 'vscode';
import { ProgressLocation } from 'vscode';

export interface IVSCodeWindow {
  withProgress<R>(
    progressTitle: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Thenable<R>,
  ): Promise<R>;
}

/**
 * A wrapper class for the vscode.window to provide centralised access to dealing with the current window of the editor.
 */
export class VSCodeWindow implements IVSCodeWindow {
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
