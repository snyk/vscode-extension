import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import { Configuration, IConfiguration, SeverityFilter } from '../configuration/configuration';
import { User } from '../user';

export type ServerSettings = {
  // Feature toggles
  activateSnykCodeSecurity?: string;
  activateSnykCodeQuality?: string;
  activateSnykOpenSource?: string;
  activateSnykIac?: string;

  // Endpoint path, and organization
  path?: string;
  cliPath?: string;
  endpoint?: string;
  organization?: string;

  // Authentication and parameters
  token?: string;
  automaticAuthentication?: string;
  additionalParams?: string;
  manageBinariesAutomatically?: string;

  // Reporting and telemetry
  sendErrorReports?: string;
  enableTelemetry?: string;
  enableAnalytics?: boolean;

  // Security and scanning settings
  filterSeverity?: SeverityFilter;
  scanningMode?: string;
  insecure?: string;

  // Trusted folders feature
  enableTrustedFoldersFeature?: string;
  trustedFolders?: string[];

  // Snyk integration settings
  integrationName?: string;
  integrationVersion?: string;
  deviceId?: string;
};

/**
 * Transforms a boolean or undefined value into a string representation.
 * It guarantees that undefined values are represented as 'true'.
 * This utility is used to ensure feature flags are enabled by default
 * when not explicitly set to false.
 *
 * @param {boolean | undefined} value - The value to transform.
 * @returns {string} - The string 'true' if the value is undefined or truthy, 'false' if the value is false.
 */
export const defaultToTrue = (value: boolean | undefined): string => {
  return `${value !== undefined ? value : true}`;
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration, user: User): Promise<ServerSettings> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();

    const iacEnabled = defaultToTrue(featuresConfiguration.iacEnabled);
    const codeSecurityEnabled = defaultToTrue(featuresConfiguration.codeSecurityEnabled);
    const codeQualityEnabled = defaultToTrue(featuresConfiguration.codeQualityEnabled);

    return {
      activateSnykCodeSecurity: codeSecurityEnabled,
      activateSnykCodeQuality: codeQualityEnabled,
      activateSnykOpenSource: 'false',
      activateSnykIac: iacEnabled,

      cliPath: configuration.getCliPath(),
      endpoint: configuration.snykOssApiEndpoint,
      organization: configuration.organization,

      token: await configuration.getToken(),
      automaticAuthentication: 'false',
      additionalParams: configuration.getAdditionalCliParameters(),
      manageBinariesAutomatically: `${configuration.isAutomaticDependencyManagementEnabled()}`,

      sendErrorReports: `${configuration.shouldReportErrors}`,
      enableTelemetry: `${configuration.shouldReportEvents}`,
      enableAnalytics: configuration.shouldReportAnalytics,

      filterSeverity: configuration.severityFilter,
      scanningMode: configuration.scanningMode,
      insecure: `${configuration.getInsecure()}`,

      enableTrustedFoldersFeature: 'true',
      trustedFolders: configuration.getTrustedFolders(),

      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      deviceId: user.anonymousId,
    };
  }
}
