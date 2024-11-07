import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';

export function stubWorkspaceConfiguration<T>(configSetting: string, returnValue: T | undefined): IVSCodeWorkspace {
  return {
    getConfiguration: (identifier: string, key: string) => {
      if (`${identifier}.${key}` === configSetting) return returnValue;
      return undefined;
    },
    updateConfiguration(_configurationIdentifier, _section, _value, _configurationTarget, _overrideInLanguage) {
      return Promise.resolve();
    },
  } as IVSCodeWorkspace;
}
