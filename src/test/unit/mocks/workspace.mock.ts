// ABOUTME: Mock utilities for creating IVSCodeWorkspace instances for testing
// ABOUTME: Provides helpers for stubbing workspace configuration and inspection
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import { WorkspaceFolder } from '../../../snyk/common/vscode/types';
import sinon from 'sinon';
import { Uri } from 'vscode';

export function stubWorkspaceConfiguration<T>(configSetting: string, returnValue: T | undefined): IVSCodeWorkspace {
  return {
    getConfiguration: (identifier: string, key: string, _workspaceFolder?) => {
      if (`${identifier}.${key}` === configSetting) return returnValue;
      return undefined;
    },
    updateConfiguration(_configurationIdentifier, _section, _value, _configurationTarget, _overrideInLanguage) {
      return Promise.resolve();
    },
  } as IVSCodeWorkspace;
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
    updateConfiguration: sinon.stub().returns(Promise.resolve()),
  } as unknown as IVSCodeWorkspace;
}
