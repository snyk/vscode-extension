import _ from 'lodash';
import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration, SeverityFilter } from '../configuration/configuration';
import { User } from '../user';

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
  insecure?: string;
  scanningMode?: string;

  integrationName?: string;
  integrationVersion?: string;
  automaticAuthentication?: string;
  deviceId?: string;
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration, user: User): Promise<ServerSettings> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();

    const iacEnabled = _.isUndefined(featuresConfiguration.iacEnabled) ? true : featuresConfiguration.iacEnabled;
    const codeSecurityEnabled = _.isUndefined(featuresConfiguration.codeSecurityEnabled)
      ? true
      : featuresConfiguration.codeSecurityEnabled;
    const codeQualityEnabled = _.isUndefined(featuresConfiguration.codeQualityEnabled)
      ? true
      : featuresConfiguration.codeQualityEnabled;

    return {
      activateSnykCodeSecurity: `${codeSecurityEnabled}`,
      activateSnykCodeQuality: `${codeQualityEnabled}`,
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
      insecure: `${configuration.getInsecure()}`,
      scanningMode: configuration.scanningMode,

      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      deviceId: user.anonymousId,
      automaticAuthentication: 'false',
    };
  }
}
