import _ from 'lodash';
import { CLI_INTEGRATION_NAME } from '../../cli/contants/integration';
import {
  Configuration,
  FolderConfig,
  IConfiguration,
  IssueViewOptions,
  SeverityFilter,
} from '../configuration/configuration';
import { User } from '../user';
import { PROTOCOL_VERSION } from '../constants/languageServer';
import { LanguageServer } from './languageServer';
import { vsCodeWorkspace } from '../vscode/workspace';

export type ServerSettings = {
  // Feature toggles
  activateSnykCodeSecurity?: string;
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
  authenticationMethod?: string;
  additionalParams?: string;
  manageBinariesAutomatically?: string;

  // Reporting and telemetry
  sendErrorReports?: string;

  // Security and scanning settings
  filterSeverity?: SeverityFilter;
  issueViewOptions?: IssueViewOptions;
  scanningMode?: string;
  insecure?: string;

  // Trusted folders feature
  enableTrustedFoldersFeature?: string;
  trustedFolders?: string[];

  // Snyk integration settings
  integrationName?: string;
  integrationVersion?: string;
  deviceId?: string;
  requiredProtocolVersion?: string;
  enableDeltaFindings?: string;
  folderConfigs: FolderConfig[];
  enableSnykOSSQuickFixCodeActions: string;
  hoverVerbosity: number;
  // Environment/Editor Info
  runtimeName?: string;
  runtimeVersion?: string;
  osArch?: string;
  osPlatform?: string;
  additionalEnv?: string;
};

export class LanguageServerSettings {
  static async fromConfiguration(configuration: IConfiguration, user: User): Promise<ServerSettings> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();

    const ossEnabled = _.isUndefined(featuresConfiguration?.ossEnabled)
      ? 'true'
      : `${featuresConfiguration?.ossEnabled}`;

    const iacEnabled = _.isUndefined(featuresConfiguration?.iacEnabled)
      ? 'true'
      : `${featuresConfiguration?.iacEnabled}`;

    const codeSecurityEnabled = _.isUndefined(featuresConfiguration?.codeSecurityEnabled)
      ? 'true'
      : `${featuresConfiguration?.codeSecurityEnabled}`;

    return {
      activateSnykCodeSecurity: codeSecurityEnabled,
      activateSnykOpenSource: ossEnabled,
      activateSnykIac: iacEnabled,
      enableDeltaFindings: `${configuration.getDeltaFindingsEnabled()}`,
      sendErrorReports: `${configuration.shouldReportErrors}`,
      cliPath: await configuration.getCliPath(),
      endpoint: configuration.snykApiEndpoint,
      organization: configuration.organization,
      token: await configuration.getToken(),
      automaticAuthentication: 'false',
      authenticationMethod: configuration.getAuthenticationMethod(),
      additionalParams: configuration.getAdditionalCliParameters(),
      manageBinariesAutomatically: `${configuration.isAutomaticDependencyManagementEnabled()}`,
      filterSeverity: configuration.severityFilter,
      issueViewOptions: configuration.issueViewOptions,
      scanningMode: configuration.scanningMode,
      insecure: `${configuration.getInsecure()}`,
      enableTrustedFoldersFeature: 'true',
      trustedFolders: configuration.getTrustedFolders().map((value, _index, _array) => {
        const wf = vsCodeWorkspace.getWorkspaceFolders()?.[0];
        if (wf) {
          return value.replace('${workspaceFolder}', wf);
        } else {
          return value;
        }
      }),
      integrationName: CLI_INTEGRATION_NAME,
      integrationVersion: await Configuration.getVersion(),
      deviceId: user.anonymousId,
      requiredProtocolVersion: `${PROTOCOL_VERSION}`,
      folderConfigs: LanguageServer.ReceivedFolderConfigsFromLs ? configuration.getFolderConfigs().map((value, _index, _array) => {
        const wf = vsCodeWorkspace.getWorkspaceFolders()?.[0];
        if (wf) {
          return {
            folderPath: value.folderPath.replace('${workspaceFolder}', wf),
            baseBranch: value.baseBranch,
            localBranches: value.localBranches,
          };
        }
        return value;
      }) : [],
      enableSnykOSSQuickFixCodeActions: `${configuration.getPreviewFeatures().ossQuickfixes}`,
      hoverVerbosity: 1,
    };
  }
}
