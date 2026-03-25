import _ from 'lodash';
import type { IConfiguration } from '../../../configuration/configuration';
import { PFLAG } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from '../../../languageServer/explicitLspConfigurationChangeTracker';
import type { IdeConfigData } from '../types/workspaceConfiguration.types';

/**
 * Marks pflag keys as explicit user overrides when the workspace config webview save changes
 * values compared to the current {@link IConfiguration} snapshot (IntelliJ SaveConfigHandler parity).
 */
export async function markExplicitPflagsFromIdeConfigDiff(
  config: IdeConfigData,
  configuration: IConfiguration,
  tracker: IExplicitLspConfigurationChangeTracker,
  isCliOnly: boolean,
): Promise<void> {
  if (isCliOnly) {
    await markCliOnlyExplicitPflagsFromIdeConfigDiff(config, configuration, tracker);
    return;
  }

  const fc = configuration.getFeaturesConfiguration();
  const oss = fc?.ossEnabled ?? true;
  if (config.activateSnykOpenSource !== undefined && config.activateSnykOpenSource !== oss) {
    tracker.markExplicitlyChanged(PFLAG.snykOssEnabled);
  }
  const code = fc?.codeSecurityEnabled ?? true;
  if (config.activateSnykCode !== undefined && config.activateSnykCode !== code) {
    tracker.markExplicitlyChanged(PFLAG.snykCodeEnabled);
  }
  const iac = fc?.iacEnabled ?? true;
  if (config.activateSnykIac !== undefined && config.activateSnykIac !== iac) {
    tracker.markExplicitlyChanged(PFLAG.snykIacEnabled);
  }
  const secrets = fc?.secretsEnabled !== undefined ? fc.secretsEnabled : true;
  if (config.activateSnykSecrets !== undefined && config.activateSnykSecrets !== secrets) {
    tracker.markExplicitlyChanged(PFLAG.snykSecretsEnabled);
  }

  if (config.scanningMode !== undefined && config.scanningMode !== configuration.scanningMode) {
    tracker.markExplicitlyChanged(PFLAG.scanAutomatic);
  }

  if (config.organization !== undefined && config.organization !== configuration.organization) {
    tracker.markExplicitlyChanged(PFLAG.organization);
  }

  const existingToken = (await configuration.getToken())?.trim() ?? '';
  const newToken = config.token?.trim() ?? '';
  if (newToken !== existingToken) {
    tracker.markExplicitlyChanged(PFLAG.token);
  }

  if (config.endpoint !== undefined && config.endpoint !== configuration.snykApiEndpoint) {
    tracker.markExplicitlyChanged(PFLAG.apiEndpoint);
  }

  if (config.insecure !== undefined && config.insecure !== configuration.getInsecure()) {
    tracker.markExplicitlyChanged(PFLAG.cliInsecure);
  }

  if (
    config.authenticationMethod !== undefined &&
    config.authenticationMethod !== configuration.getAuthenticationMethod()
  ) {
    tracker.markExplicitlyChanged(PFLAG.authenticationMethod);
  }

  if (
    config.enableDeltaFindings !== undefined &&
    config.enableDeltaFindings !== configuration.getDeltaFindingsEnabled()
  ) {
    tracker.markExplicitlyChanged(PFLAG.scanNetNew);
  }

  if (config.filterSeverity !== undefined && !_.isEqual(config.filterSeverity, configuration.severityFilter)) {
    tracker.markExplicitlyChanged(PFLAG.enabledSeverities);
  }

  if (config.issueViewOptions !== undefined && !_.isEqual(config.issueViewOptions, configuration.issueViewOptions)) {
    tracker.markExplicitlyChanged(PFLAG.issueViewOpenIssues);
    tracker.markExplicitlyChanged(PFLAG.issueViewIgnoredIssues);
  }

  if (config.riskScoreThreshold !== undefined && config.riskScoreThreshold !== configuration.riskScoreThreshold) {
    tracker.markExplicitlyChanged(PFLAG.riskScoreThreshold);
  }

  if (
    config.trustedFolders !== undefined &&
    !_.isEqual([...config.trustedFolders].sort(), [...configuration.getTrustedFolders()].sort())
  ) {
    tracker.markExplicitlyChanged(PFLAG.trustedFolders);
  }

  const currentCli = await configuration.getCliPath();
  if (config.cliPath !== undefined && config.cliPath !== currentCli) {
    tracker.markExplicitlyChanged(PFLAG.cliPath);
  }

  if (
    config.manageBinariesAutomatically !== undefined &&
    config.manageBinariesAutomatically !== configuration.isAutomaticDependencyManagementEnabled()
  ) {
    tracker.markExplicitlyChanged(PFLAG.automaticDownload);
  }

  if (config.cliBaseDownloadURL !== undefined && config.cliBaseDownloadURL !== configuration.getCliBaseDownloadUrl()) {
    tracker.markExplicitlyChanged(PFLAG.binaryBaseUrl);
  }
}

async function markCliOnlyExplicitPflagsFromIdeConfigDiff(
  config: IdeConfigData,
  configuration: IConfiguration,
  tracker: IExplicitLspConfigurationChangeTracker,
): Promise<void> {
  const currentCli = await configuration.getCliPath();
  if (config.cliPath !== undefined && config.cliPath !== currentCli) {
    tracker.markExplicitlyChanged(PFLAG.cliPath);
  }
  if (
    config.manageBinariesAutomatically !== undefined &&
    config.manageBinariesAutomatically !== configuration.isAutomaticDependencyManagementEnabled()
  ) {
    tracker.markExplicitlyChanged(PFLAG.automaticDownload);
  }
  if (config.cliBaseDownloadURL !== undefined && config.cliBaseDownloadURL !== configuration.getCliBaseDownloadUrl()) {
    tracker.markExplicitlyChanged(PFLAG.binaryBaseUrl);
  }
}
