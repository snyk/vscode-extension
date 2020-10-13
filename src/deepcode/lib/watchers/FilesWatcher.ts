import * as vscode from 'vscode';
import { ExtensionInterface } from '../../../interfaces/DeepCodeInterfaces';

import { getGlobPatterns, ISupportedFiles } from '@deepcode/tsc';

export default function createFileWatcher(
  extension: ExtensionInterface,
  supportedFiles: ISupportedFiles,
): vscode.FileSystemWatcher {
  const globPattern: vscode.GlobPattern = `**/\{${getGlobPatterns(supportedFiles).join(',')}\}`;
  const watcher = vscode.workspace.createFileSystemWatcher(globPattern);

  const updateFiles = (filePath: string): void => {
    extension.changedFiles.add(filePath);
    extension.startExtension(); // It's debounced, so not worries about concurrent calls
  };

  watcher.onDidChange((documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });
  watcher.onDidDelete(async (documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });
  watcher.onDidCreate((documentUri: vscode.Uri) => {
    updateFiles(documentUri.fsPath);
  });

  return watcher;
}
