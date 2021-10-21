import { getGlobPatterns, SupportedFiles } from '@snyk/code-client';
import * as vscode from 'vscode';
import { IExtension } from '../../base/modules/interfaces';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

export default function createFileWatcher(
  extension: IExtension,
  workspace: IVSCodeWorkspace,
  supportedFiles: SupportedFiles,
): vscode.FileSystemWatcher {
  const globPattern: vscode.GlobPattern = `**/{${getGlobPatterns(supportedFiles).join(',')}}`;
  const watcher = workspace.createFileSystemWatcher(globPattern);

  const updateFiles = (filePath: string): void => {
    extension.snykCode.addChangedFile(filePath);
    void extension.runCodeScan(); // It's debounced, so not worries about concurrent calls
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
