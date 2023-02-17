import _ from 'lodash';
import { IConfiguration, SeverityFilter } from '../configuration/configuration';
import { ExperimentKey, ExperimentService } from '../experiment/services/experimentService';

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
  insecure?: string;
  scanningMode?: string;
};

export class LanguageServerSettings {
  static async fromConfiguration(
    configuration: IConfiguration,
    experimentService: ExperimentService,
  ): Promise<ServerSettings> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();

    const iacEnabled = _.isUndefined(featuresConfiguration.iacEnabled) ? true : featuresConfiguration.iacEnabled;
    let codeSecurityEnabled = _.isUndefined(featuresConfiguration.codeSecurityEnabled)
      ? true
      : featuresConfiguration.codeSecurityEnabled;
    let codeQualityEnabled = _.isUndefined(featuresConfiguration.codeQualityEnabled)
      ? true
      : featuresConfiguration.codeQualityEnabled;

    const codeScansViaLs = await experimentService.isUserPartOfExperiment(ExperimentKey.CodeScansViaLanguageServer);
    if (!codeScansViaLs) {
      codeSecurityEnabled = false;
      codeQualityEnabled = false;
    }

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
    };
  }
}
