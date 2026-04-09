import _ from 'lodash';
import type { IConfiguration } from '../../../configuration/configuration';
import { LS_KEY } from '../../../languageServer/serverSettingsToLspConfigurationParam';
import type { IExplicitLspConfigurationChangeTracker } from '../../../languageServer/explicitLspConfigurationChangeTracker';
import type { IdeConfigData } from '../types/workspaceConfiguration.types';

/**
 * Marks LS keys as explicit user overrides when the workspace config webview save changes
 * values compared to the current {@link IConfiguration} snapshot.
 */
export async function markExplicitLsKeysFromIdeConfigDiff(
  config: IdeConfigData,
  configuration: IConfiguration,
  tracker: IExplicitLspConfigurationChangeTracker,
  isCliOnly: boolean,
): Promise<void> {
  if (isCliOnly) {
    await markCliOnlyExplicitLsKeysFromIdeConfigDiff(config, configuration, tracker);
    return;
  }

  const fc = configuration.getFeaturesConfiguration();
  const oss = fc?.ossEnabled ?? true;
  if (config.activateSnykOpenSource !== undefined && config.activateSnykOpenSource !== oss) {
    tracker.markExplicitlyChanged(LS_KEY.snykOssEnabled);
  }
  const code = fc?.codeSecurityEnabled ?? true;
  if (config.activateSnykCode !== undefined && config.activateSnykCode !== code) {
    tracker.markExplicitlyChanged(LS_KEY.snykCodeEnabled);
  }
  const iac = fc?.iacEnabled ?? true;
  if (config.activateSnykIac !== undefined && config.activateSnykIac !== iac) {
    tracker.markExplicitlyChanged(LS_KEY.snykIacEnabled);
  }
  const secrets = fc?.secretsEnabled !== undefined ? fc.secretsEnabled : true;
  if (config.activateSnykSecrets !== undefined && config.activateSnykSecrets !== secrets) {
    tracker.markExplicitlyChanged(LS_KEY.snykSecretsEnabled);
  }

  if (config.scanningMode !== undefined && config.scanningMode !== configuration.scanningMode) {
    tracker.markExplicitlyChanged(LS_KEY.scanAutomatic);
  }

  if (config.organization !== undefined && config.organization !== configuration.organization) {
    tracker.markExplicitlyChanged(LS_KEY.organization);
  }

  const existingToken = (await configuration.getToken())?.trim() ?? '';
  const newToken = config.token?.trim() ?? '';
  if (newToken !== existingToken) {
    tracker.markExplicitlyChanged(LS_KEY.token);
  }

  if (config.endpoint !== undefined && config.endpoint !== configuration.snykApiEndpoint) {
    tracker.markExplicitlyChanged(LS_KEY.apiEndpoint);
  }

  if (config.insecure !== undefined && config.insecure !== configuration.getInsecure()) {
    tracker.markExplicitlyChanged(LS_KEY.proxyInsecure);
  }

  if (
    config.authenticationMethod !== undefined &&
    config.authenticationMethod !== configuration.getAuthenticationMethod()
  ) {
    tracker.markExplicitlyChanged(LS_KEY.authenticationMethod);
  }

  if (
    config.enableDeltaFindings !== undefined &&
    config.enableDeltaFindings !== configuration.getDeltaFindingsEnabled()
  ) {
    tracker.markExplicitlyChanged(LS_KEY.scanNetNew);
  }

  if (config.filterSeverity !== undefined && !_.isEqual(config.filterSeverity, configuration.severityFilter)) {
    tracker.markExplicitlyChanged(LS_KEY.enabledSeverities);
  }

  if (config.issueViewOptions !== undefined && !_.isEqual(config.issueViewOptions, configuration.issueViewOptions)) {
    tracker.markExplicitlyChanged(LS_KEY.issueViewOpenIssues);
    tracker.markExplicitlyChanged(LS_KEY.issueViewIgnoredIssues);
  }

  if (config.riskScoreThreshold !== undefined && config.riskScoreThreshold !== configuration.riskScoreThreshold) {
    tracker.markExplicitlyChanged(LS_KEY.riskScoreThreshold);
  }

  if (
    config.trustedFolders !== undefined &&
    !_.isEqual([...config.trustedFolders].sort(), [...configuration.getTrustedFolders()].sort())
  ) {
    tracker.markExplicitlyChanged(LS_KEY.trustedFolders);
  }

  const currentCli = await configuration.getCliPath();
  if (config.cliPath !== undefined && config.cliPath !== currentCli) {
    tracker.markExplicitlyChanged(LS_KEY.cliPath);
  }

  if (
    config.manageBinariesAutomatically !== undefined &&
    config.manageBinariesAutomatically !== configuration.isAutomaticDependencyManagementEnabled()
  ) {
    tracker.markExplicitlyChanged(LS_KEY.automaticDownload);
  }

  if (config.cliBaseDownloadURL !== undefined && config.cliBaseDownloadURL !== configuration.getCliBaseDownloadUrl()) {
    tracker.markExplicitlyChanged(LS_KEY.binaryBaseUrl);
  }
}

async function markCliOnlyExplicitLsKeysFromIdeConfigDiff(
  config: IdeConfigData,
  configuration: IConfiguration,
  tracker: IExplicitLspConfigurationChangeTracker,
): Promise<void> {
  const currentCli = await configuration.getCliPath();
  if (config.cliPath !== undefined && config.cliPath !== currentCli) {
    tracker.markExplicitlyChanged(LS_KEY.cliPath);
  }
  if (
    config.manageBinariesAutomatically !== undefined &&
    config.manageBinariesAutomatically !== configuration.isAutomaticDependencyManagementEnabled()
  ) {
    tracker.markExplicitlyChanged(LS_KEY.automaticDownload);
  }
  if (config.cliBaseDownloadURL !== undefined && config.cliBaseDownloadURL !== configuration.getCliBaseDownloadUrl()) {
    tracker.markExplicitlyChanged(LS_KEY.binaryBaseUrl);
  }
}
