import * as vscode from 'vscode';

export interface IVSCodeWorkspace {
  getConfiguration<T>(configurationIdentifier: string, section: string): T | undefined;
  updateConfiguration(
    configurationIdentifier: string,
    section: string,
    value: any,
    configurationTarget?: boolean,
    overrideInLanguage?: boolean,
  ): Promise<void>;
  workspaceFolders(): string[];
  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher;
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

  workspaceFolders(): string[] {
    return (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
  }

  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher {
    return vscode.workspace.createFileSystemWatcher(globPattern);
  }
}

export const vsCodeWorkspace = new VSCodeWorkspace();
