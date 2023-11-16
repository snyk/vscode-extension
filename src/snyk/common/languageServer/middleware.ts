import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration } from '../../common/configuration/configuration';
import { User } from '../user';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  WorkspaceMiddleware,
} from '../vscode/types';
import { LanguageServerSettings, ServerSettings } from './settings';

export type LanguageClientWorkspaceMiddleware = Partial<WorkspaceMiddleware> & {
  configuration: (
    params: ConfigurationParams,
    token: CancellationToken,
    next: ConfigurationRequestHandlerSignature,
  ) => Promise<ResponseError<void> | ServerSettings[]>;
};

export class LanguageClientMiddleware implements Middleware {
  constructor(private configuration: IConfiguration, private user: User) {}

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

      const serverSettings = await LanguageServerSettings.fromConfiguration(this.configuration);

      return [
        {
          ...serverSettings,
          integrationName: CLI_INTEGRATION_NAME,
          integrationVersion: await Configuration.getVersion(),
          deviceId: this.user.anonymousId,
          automaticAuthentication: 'false',
        },
      ];
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isThenable<T>(v: any): v is Thenable<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return typeof v?.then === 'function';
  }
}
