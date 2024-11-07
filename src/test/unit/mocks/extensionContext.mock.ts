import { ExtensionContext } from '../../../snyk/common/vscode/types';

export const extensionContextMock = {
  secrets: {
    store: (_key: string, _value: string) => Promise.resolve(),
    get: () => Promise.resolve(),
  },
  extensionPath: 'path/to/extension',
} as unknown as ExtensionContext;
