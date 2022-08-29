import {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  WorkspaceMiddleware,
} from '../vscode/types';
import { ClientSettings, ServerSettings } from './settings';

export type LanguageClientWorkspaceMiddleware = Partial<WorkspaceMiddleware> & {
  configuration: (
    params: ConfigurationParams,
    token: CancellationToken,
    next: ConfigurationRequestHandlerSignature,
  ) => Promise<ResponseError<void> | ServerSettings[]>;
};

export class LanguageClientMiddleware implements Middleware {
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

      const clientSettings = settings[0] as ClientSettings;
      // We should ideally have no setting translation and deliver LS-relevant only.
      const serverSettings = [
        {
          activateSnykCode: 'false', // TODO: split into security and quality
          activateSnykOpenSource: 'false',
          activateSnykIac: 'false',
          endpoint: clientSettings.advanced.customEndpoint,
          additionalParams: clientSettings.advanced.additionalParameters,
          sendErrorReports: `${clientSettings.yesCrashReport}`,
          organization: `${clientSettings.advanced.organization}`,
          enableTelemetry: `${clientSettings.yesTelemetry}`,
          manageBinariesAutomatically: `${clientSettings.advanced.automaticDependencyManagement}`,
          cliPath: `${clientSettings.advanced.cliPath}`,
          // TODO: path,
          // TODO: autoScanOpenSourceSecurity
        } as ServerSettings,
      ];

      return serverSettings;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isThenable<T>(v: any): v is Thenable<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return typeof v?.then === 'function';
  }
}
