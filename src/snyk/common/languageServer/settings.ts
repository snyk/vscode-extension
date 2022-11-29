import { IConfiguration } from '../configuration/configuration';

export type InitializationOptions = ServerSettings & {
  integrationName?: string;
  integrationVersion?: string;
  automaticAuthentication?: string;
  deviceId?: string;
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
  enableTrustedFoldersFeature?: string;
  trustedFolders?: string[];
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration): Promise<ServerSettings> {
    return {
      activateSnykCode: 'false',
      activateSnykOpenSource: 'false',
      activateSnykIac: `${configuration.getPreviewFeatures().lsIacScan}`,
      enableTelemetry: `${configuration.shouldReportEvents}`,
      sendErrorReports: `${configuration.shouldReportErrors}`,
      cliPath: configuration.getCliPath(),
      endpoint: configuration.snykOssApiEndpoint,
      additionalParams: configuration.getAdditionalCliParameters(),
      organization: configuration.organization,
      token: await configuration.getToken(),
      manageBinariesAutomatically: `${configuration.isAutomaticDependencyManagementEnabled()}`,
      enableTrustedFoldersFeature: 'true',
      trustedFolders: configuration.getTrustedFolders(),
    };
  }
}
