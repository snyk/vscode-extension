import * as vscode from 'vscode';
import { getGlobPatterns, ISupportedFiles } from '@snyk/code-client';
import { ExtensionInterface } from '../../../interfaces/SnykInterfaces';

export default function createFileWatcher(
  extension: ExtensionInterface,
  supportedFiles: ISupportedFiles,
): vscode.FileSystemWatcher {
  const globPattern: vscode.GlobPattern = `**/\{${getGlobPatterns(supportedFiles).join(',')}\}`;
  const watcher = vscode.workspace.createFileSystemWatcher(globPattern);

  const updateFiles = (filePath: string): void => {
    extension.changedFiles.add(filePath);
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
