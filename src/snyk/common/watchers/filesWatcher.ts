import { getGlobPatterns, SupportedFiles } from '@snyk/code-client';
import * as vscode from 'vscode';
import { IExtension } from '../../base/modules/interfaces';

export default function createFileWatcher(
  extension: IExtension,
  supportedFiles: SupportedFiles,
): vscode.FileSystemWatcher {
  // eslint-disable-next-line no-useless-escape
  const globPattern: vscode.GlobPattern = `**/\{${getGlobPatterns(supportedFiles).join(',')}\}`;
  const watcher = vscode.workspace.createFileSystemWatcher(globPattern);

  const updateFiles = (filePath: string): void => {
    extension.snykCode.changedFiles.add(filePath);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    extension.startExtension(); // It's debounced, so not worries about concurrent calls
  };

  watcher.onDidChange((documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });
  watcher.onDidDelete((documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });
  watcher.onDidCreate((documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });

  return watcher;
}
