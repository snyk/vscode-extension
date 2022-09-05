import { CliExecutable } from '../../cli/cliExecutable';
import { IConfiguration } from '../configuration/configuration';

export type InitializationOptions = ServerSettings & {
  integrationName?: string;
  integrationVersion?: string;
};

export type ServerSettings = {
  activateSnykCode?: string;
  activateSnykOpenSource?: string;
  activateSnykIac?: string;
  endpoint?: string;
  additionalParams?: string;
  path?: string;
  sendErrorReports?: string;
  organization?: string;
  enableTelemetry?: string;
  manageBinariesAutomatically?: string;
  cliPath?: string;
  token?: string;
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration, extensionPath: string): Promise<ServerSettings> {
    return {
      activateSnykCode: 'false',
      activateSnykOpenSource: 'false',
      activateSnykIac: 'false',
      enableTelemetry: `${configuration.shouldReportEvents}`,
      sendErrorReports: `${configuration.shouldReportErrors}`,
      cliPath: CliExecutable.getPath(extensionPath, configuration.getCustomCliPath()),
      endpoint: configuration.snykOssApiEndpoint,
      additionalParams: configuration.getAdditionalCliParameters(),
      organization: configuration.organization,
      token: await configuration.getToken(),
      manageBinariesAutomatically: `${configuration.isAutomaticDependencyManagementEnabled()}`,
    };
  }
}
