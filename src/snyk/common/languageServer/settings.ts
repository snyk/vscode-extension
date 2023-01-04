import _ from 'lodash';
import { IConfiguration, SeverityFilter } from '../configuration/configuration';

export type InitializationOptions = ServerSettings & {
  integrationName?: string;
  integrationVersion?: string;
  automaticAuthentication?: string;
  deviceId?: string;
};

export type ServerSettings = {
  activateSnykCodeSecurity?: string;
  activateSnykCodeQuality?: string;
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
  filterSeverity?: SeverityFilter;
  enableTrustedFoldersFeature?: string;
  trustedFolders?: string[];
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration): Promise<ServerSettings> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();

    const iacEnabled = _.isUndefined(featuresConfiguration.iacEnabled) ? true : featuresConfiguration.iacEnabled;
    const codeSecurityEnabled = configuration.getPreviewFeatures().lsCode && featuresConfiguration?.codeSecurityEnabled;
    const codeQualityEnabled = configuration.getPreviewFeatures().lsCode && featuresConfiguration?.codeQualityEnabled;

    return {
      activateSnykCodeSecurity: `${codeSecurityEnabled ?? false}`,
      activateSnykCodeQuality: `${codeQualityEnabled ?? false}`,
      activateSnykOpenSource: 'false',
      activateSnykIac: `${iacEnabled}`,
      enableTelemetry: `${configuration.shouldReportEvents}`,
      sendErrorReports: `${configuration.shouldReportErrors}`,
      cliPath: configuration.getCliPath(),
      endpoint: configuration.snykOssApiEndpoint,
      additionalParams: configuration.getAdditionalCliParameters(),
      organization: configuration.organization,
      token: await configuration.getToken(),
      manageBinariesAutomatically: `${configuration.isAutomaticDependencyManagementEnabled()}`,
      filterSeverity: configuration.severityFilter,
      enableTrustedFoldersFeature: 'true',
      trustedFolders: configuration.getTrustedFolders(),
    };
  }
}
