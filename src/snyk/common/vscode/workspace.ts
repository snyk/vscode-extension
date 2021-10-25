import * as vscode from 'vscode';
import { TextDocumentChangeEvent } from 'vscode';

export interface IVSCodeWorkspace {
  getConfiguration<T>(configurationIdentifier: string, section: string): T | undefined;
  updateConfiguration(
    configurationIdentifier: string,
    section: string,
    value: any,
    configurationTarget?: boolean,
    overrideInLanguage?: boolean,
  ): Promise<void>;
  getWorkspaceFolders(): string[];
  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher;
  onDidChangeTextDocument(listener: (e: TextDocumentChangeEvent) => unknown): vscode.Disposable;
}

/**
 * A wrapper class for the vscode.workspace to provide centralised access to dealing with the current workspace.
 */
export class VSCodeWorkspace implements IVSCodeWorkspace {
  getConfiguration<T>(configurationIdentifier: string, section: string): T | undefined {
    return vscode.workspace.getConfiguration(configurationIdentifier).get(section);
  }

  updateConfiguration(
    configurationIdentifier: string,
    section: string,
    value: any,
    configurationTarget?: boolean,
    overrideInLanguage?: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      vscode.workspace
        .getConfiguration(configurationIdentifier)
        .update(section, value, configurationTarget, overrideInLanguage)
        .then(
          () => resolve(),
          reason => reject(reason),
        );
    });
  }

  getWorkspaceFolders(): string[] {
    return (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
  }

  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher {
    return vscode.workspace.createFileSystemWatcher(globPattern);
  }

  onDidChangeTextDocument(listener: (e: vscode.TextDocumentChangeEvent) => unknown): vscode.Disposable {
    return vscode.workspace.onDidChangeTextDocument(listener);
  }
}

export const vsCodeWorkspace = new VSCodeWorkspace();
