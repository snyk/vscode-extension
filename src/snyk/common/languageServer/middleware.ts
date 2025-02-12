import { CancellationToken, RequestHandler, ShowDocumentRequest, WindowMiddleware } from 'vscode-languageclient';
import { IConfiguration } from '../../common/configuration/configuration';
import { User } from '../user';
import { ExtensionContext } from '../vscode/extensionContext';
import type {
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  WorkspaceMiddleware,
  ShowDocumentParams,
  ShowDocumentResult,
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
  window: WindowMiddleware = {
    showDocument: async (
      params: ShowDocumentParams,
      next,
    ) => {
      if (params.uri.startsWith('snyk:')) {
        console.log(`Intercepted window/showDocument request: ${params.uri}`);
      }
      const result = await next(params, CancellationToken.None);

      return result as ShowDocumentResult;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isThenable<T>(v: any): v is Thenable<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return typeof v?.then === 'function';
  }
}
function isResponseError(result: import("vscode-languageclient").ResponseError<void> | import("vscode-languageclient").ShowDocumentResult) {
  throw new Error('Function not implemented.');
}

