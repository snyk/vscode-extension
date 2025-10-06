import * as vscode from 'vscode';
import { TextDocumentChangeEvent } from 'vscode';
import { TextDocument, Uri, WorkspaceFolder } from './types';

export interface IVSCodeWorkspace {
  fs: vscode.FileSystem;

  getConfiguration<T>(
    configurationIdentifier: string,
    section: string,
    workspaceFolder?: WorkspaceFolder,
  ): T | undefined;

  inspectConfiguration<T>(
    configurationIdentifier: string,
    section: string,
    workspaceFolder?: WorkspaceFolder,
  ):
    | {
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
        defaultValue?: T;
      }
    | undefined;

  updateConfiguration(
    configurationIdentifier: string,
    section: string,
    value: unknown,
    configurationTarget?: boolean | WorkspaceFolder,
    overrideInLanguage?: boolean,
  ): Promise<void>;

  getWorkspaceFolders(): readonly WorkspaceFolder[];

  getWorkspaceFolderPaths(): string[];

  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher;

  onDidChangeTextDocument(listener: (e: TextDocumentChangeEvent) => unknown): vscode.Disposable;

  openFileTextDocument(fileName: string): Promise<TextDocument>;

  openTextDocument(options?: { language?: string; content?: string }): Promise<TextDocument>;

  openTextDocumentViaUri(uri: Uri): Promise<TextDocument>;
}

/**
 * A wrapper class for the vscode.workspace to provide centralised access to dealing with the current workspace.
 */
export class VSCodeWorkspace implements IVSCodeWorkspace {
  getConfiguration<T>(
    configurationIdentifier: string,
    section: string,
    workspaceFolder?: WorkspaceFolder,
  ): T | undefined {
    return vscode.workspace.getConfiguration(configurationIdentifier, workspaceFolder).get(section);
  }

  inspectConfiguration<T>(
    configurationIdentifier: string,
    section: string,
    workspaceFolder?: WorkspaceFolder,
  ):
    | {
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
        defaultValue?: T;
      }
    | undefined {
    return vscode.workspace.getConfiguration(configurationIdentifier, workspaceFolder).inspect(section);
  }

  updateConfiguration(
    configurationIdentifier: string,
    section: string,
    value: unknown,
    configurationTarget?: boolean | WorkspaceFolder,
    overrideInLanguage?: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let workspaceFolder: WorkspaceFolder | undefined;
      if (typeof configurationTarget === 'object') {
        // configurationTarget is a WorkspaceFolder - set at folder level
        workspaceFolder = configurationTarget;
        configurationTarget = undefined; // undefined == folder level
      }

      vscode.workspace
        .getConfiguration(configurationIdentifier, workspaceFolder)
        .update(section, value, configurationTarget, overrideInLanguage)
        .then(
          () => resolve(),
          reason => reject(reason),
        );
    });
  }

  getWorkspaceFolders(): readonly WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders || [];
  }

  getWorkspaceFolderPaths(): string[] {
    return this.getWorkspaceFolders().map(f => f.uri.fsPath);
  }

  createFileSystemWatcher(globPattern: string): vscode.FileSystemWatcher {
    return vscode.workspace.createFileSystemWatcher(globPattern);
  }

  onDidChangeTextDocument(listener: (e: vscode.TextDocumentChangeEvent) => unknown): vscode.Disposable {
    return vscode.workspace.onDidChangeTextDocument(listener);
  }

  openFileTextDocument(fileName: string): Promise<TextDocument> {
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(fileName).then(
        doc => resolve(doc),
        reason => reject(reason),
      );
    });
  }

  openTextDocumentViaUri(uri: Uri): Promise<TextDocument> {
    return vscode.workspace.openTextDocument(uri) as Promise<TextDocument>;
  }

  openTextDocument(options?: { language?: string; content?: string }): Promise<TextDocument> {
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(options).then(
        doc => resolve(doc),
        reason => reject(reason),
      );
    });
  }

  fs = vscode.workspace.fs;
}

export const vsCodeWorkspace = new VSCodeWorkspace();
