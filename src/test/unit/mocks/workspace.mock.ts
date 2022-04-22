import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';

export function stubWorkspaceConfiguration<T>(configSetting: string, returnValue: T | undefined): IVSCodeWorkspace {
  return {
    getConfiguration: (identifier: string, key: string) => {
      if (`${identifier}.${key}` === configSetting) return returnValue;
      return undefined;
    },
  } as IVSCodeWorkspace;
}

export const workspaceMock = {
  getWorkspaceFolders() {
    return [workspaceFolder];
  },
} as IVSCodeWorkspace;

export const workspaceFolder = '/Users/snyk/project';
