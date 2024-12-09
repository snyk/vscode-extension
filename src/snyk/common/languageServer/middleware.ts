import { IConfiguration } from '../../common/configuration/configuration';
import { User } from '../user';
import { ExtensionContext } from '../vscode/extensionContext';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  WorkspaceMiddleware,
} from '../vscode/types';
import { LanguageServerSettings, ServerSettings } from './settings';

type LanguageClientWorkspaceMiddleware = Partial<WorkspaceMiddleware> & {
  configuration: (
    params: ConfigurationParams,
    token: CancellationToken,
    next: ConfigurationRequestHandlerSignature,
  ) => Promise<ResponseError<void> | ServerSettings[]>;
};

export class LanguageClientMiddleware implements Middleware {
  constructor(private configuration: IConfiguration, private user: User, private extensionContext: ExtensionContext) {}

  workspace: LanguageClientWorkspaceMiddleware = {
    configuration: async (
      params: ConfigurationParams,
      token: CancellationToken,
      next: ConfigurationRequestHandlerSignature,
    ) => {
      let settings = next(params, token);
      if (this.isThenable(settings)) {
        settings = await settings;
      }

      if (settings instanceof Error) {
        return settings;
      }

      if (!settings.length) {
        return [];
      }

      const serverSettings = await LanguageServerSettings.fromConfiguration(this.configuration, this.user);
      return [serverSettings];
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isThenable<T>(v: any): v is Thenable<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return typeof v?.then === 'function';
  }
}
