// ABOUTME: Mock utilities for creating IVSCodeWorkspace instances for testing
// ABOUTME: Provides helpers for stubbing workspace configuration and inspection
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { WorkspaceFolder } from '../../../snyk/common/vscode/types';
import sinon from 'sinon';
import type * as vscode from 'vscode';
import { Uri } from 'vscode';

export function stubWorkspaceConfiguration<T>(configSetting: string, returnValue: T | undefined): IVSCodeWorkspace {
  return {
    fs: {} as vscode.FileSystem,
    getConfiguration: (identifier: string, key: string, _workspaceFolder?: WorkspaceFolder) => {
      if (`${identifier}.${key}` === configSetting) return returnValue;
      return undefined;
    },
    inspectConfiguration: sinon.stub(),
    updateConfiguration(
      _configurationIdentifier: string,
      _section: string,
      _value: unknown,
      _configurationTarget?: boolean | WorkspaceFolder,
      _overrideInLanguage?: boolean,
    ) {
      return Promise.resolve();
    },
    getWorkspaceFolders: () => [],
    getWorkspaceFolderPaths: () => [],
    getWorkspaceFolder: () => undefined,
    createFileSystemWatcher: sinon.stub(),
    onDidChangeTextDocument: sinon.stub().returns({ dispose: sinon.stub() }),
    onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
    openFileTextDocument: sinon.stub().resolves(),
    openTextDocument: sinon.stub().resolves(),
    openTextDocumentViaUri: sinon.stub().resolves(),
  } as unknown as IVSCodeWorkspace;
}

export interface ConfigInspectionValues<T> {
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  defaultValue?: T;
}

function createMockUri(path: string): Uri {
  return {
    fsPath: path,
    scheme: 'file',
    authority: '',
    path: path,
    query: '',
    fragment: '',
    with: () => createMockUri(path),
    toString: () => `file://${path}`,
    toJSON: () => ({ fsPath: path }),
  } as Uri;
}

export function createWorkspaceMockWithInspection<T>(
  configSetting: string,
  inspectionValues: ConfigInspectionValues<T>,
  folderCount: number = 1,
): IVSCodeWorkspace {
  const mockFolders: WorkspaceFolder[] = Array.from({ length: folderCount }, (_, i) => ({
    uri: createMockUri(`/test/folder/${i}`),
    name: `folder${i}`,
    index: i,
  }));

  return {
    fs: {} as vscode.FileSystem,
    getConfiguration: (identifier: string, key: string, _workspaceFolder?: WorkspaceFolder) => {
      if (`${identifier}.${key}` !== configSetting) return undefined;

      // Return the effective value based on scope hierarchy
      return (
        inspectionValues.workspaceFolderValue ??
        inspectionValues.workspaceValue ??
        inspectionValues.globalValue ??
        inspectionValues.defaultValue
      );
    },
    inspectConfiguration: (identifier: string, key: string, _workspaceFolder?: WorkspaceFolder) => {
      if (`${identifier}.${key}` !== configSetting) return undefined;

      return inspectionValues;
    },
    getWorkspaceFolders: () => mockFolders,
    getWorkspaceFolderPaths: () => mockFolders.map(f => f.uri.fsPath),
    getWorkspaceFolder: (path: string) => mockFolders.find(f => f.uri.fsPath === path),
    createFileSystemWatcher: sinon.stub(),
    onDidChangeTextDocument: sinon.stub().returns({ dispose: sinon.stub() }),
    onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
    openFileTextDocument: sinon.stub().resolves(),
    openTextDocument: sinon.stub().resolves(),
    openTextDocumentViaUri: sinon.stub().resolves(),
    updateConfiguration: sinon.stub().returns(Promise.resolve()),
  } as unknown as IVSCodeWorkspace;
}
