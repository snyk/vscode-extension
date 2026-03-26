import _ from 'lodash';
import type { IConfiguration } from '../configuration/configuration';
import type { IdeConfigData } from '../views/workspaceConfiguration/types/workspaceConfiguration.types';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import { PFLAG } from './serverSettingsToLspConfigurationParam';

/**
 * When the user has explicitly overridden LSP pflags (memento-backed), do not persist conflicting
 * values from `$/snyk.configuration` into VS Code settings. Caller should push current IDE config
 * back to the language server when `reconcileNeeded` is true.
 */
export async function filterInboundPartialByExplicitOverrides(
  partial: Partial<IdeConfigData>,
  tracker: IExplicitLspConfigurationChangeTracker,
  configuration: IConfiguration,
): Promise<{ filtered: Partial<IdeConfigData>; reconcileNeeded: boolean }> {
  const filtered: Partial<IdeConfigData> = { ...partial };
  let reconcileNeeded = false;

  const fc = configuration.getFeaturesConfiguration();

  if (partial.activateSnykOpenSource !== undefined && tracker.isExplicitlyChanged(PFLAG.snykOssEnabled)) {
    const ide = fc?.ossEnabled ?? true;
    if (partial.activateSnykOpenSource !== ide) {
      delete filtered.activateSnykOpenSource;
      reconcileNeeded = true;
    }
  }

  if (partial.activateSnykCode !== undefined && tracker.isExplicitlyChanged(PFLAG.snykCodeEnabled)) {
    const ide = fc?.codeSecurityEnabled ?? true;
    if (partial.activateSnykCode !== ide) {
      delete filtered.activateSnykCode;
      reconcileNeeded = true;
    }
  }

  if (partial.activateSnykIac !== undefined && tracker.isExplicitlyChanged(PFLAG.snykIacEnabled)) {
    const ide = fc?.iacEnabled ?? true;
    if (partial.activateSnykIac !== ide) {
      delete filtered.activateSnykIac;
      reconcileNeeded = true;
    }
  }

  if (partial.activateSnykSecrets !== undefined && tracker.isExplicitlyChanged(PFLAG.snykSecretsEnabled)) {
    const ide = fc?.secretsEnabled !== undefined ? fc.secretsEnabled : true;
    if (partial.activateSnykSecrets !== ide) {
      delete filtered.activateSnykSecrets;
      reconcileNeeded = true;
    }
  }

  if (partial.scanningMode !== undefined && tracker.isExplicitlyChanged(PFLAG.scanAutomatic)) {
    if (partial.scanningMode !== configuration.scanningMode) {
      delete filtered.scanningMode;
      reconcileNeeded = true;
    }
  }

  if (partial.organization !== undefined && tracker.isExplicitlyChanged(PFLAG.organization)) {
    if (partial.organization !== configuration.organization) {
      delete filtered.organization;
      reconcileNeeded = true;
    }
  }

  if (partial.issueViewOptions !== undefined) {
    const openExplicit = tracker.isExplicitlyChanged(PFLAG.issueViewOpenIssues);
    const ignExplicit = tracker.isExplicitlyChanged(PFLAG.issueViewIgnoredIssues);
    if (openExplicit || ignExplicit) {
      const ide = configuration.issueViewOptions ?? {};
      const p = partial.issueViewOptions;
      const mismatch =
        (p.openIssues !== undefined && p.openIssues !== ide.openIssues) ||
        (p.ignoredIssues !== undefined && p.ignoredIssues !== ide.ignoredIssues);
      if (mismatch) {
        delete filtered.issueViewOptions;
        reconcileNeeded = true;
      }
    }
  }

  if (partial.enableDeltaFindings !== undefined && tracker.isExplicitlyChanged(PFLAG.scanNetNew)) {
    if (partial.enableDeltaFindings !== configuration.getDeltaFindingsEnabled()) {
      delete filtered.enableDeltaFindings;
      reconcileNeeded = true;
    }
  }

  if (partial.authenticationMethod !== undefined && tracker.isExplicitlyChanged(PFLAG.authenticationMethod)) {
    if (partial.authenticationMethod !== configuration.getAuthenticationMethod()) {
      delete filtered.authenticationMethod;
      reconcileNeeded = true;
    }
  }

  if (partial.endpoint !== undefined && tracker.isExplicitlyChanged(PFLAG.apiEndpoint)) {
    if (partial.endpoint !== configuration.snykApiEndpoint) {
      delete filtered.endpoint;
      reconcileNeeded = true;
    }
  }

  if (partial.insecure !== undefined && tracker.isExplicitlyChanged(PFLAG.cliInsecure)) {
    if (partial.insecure !== configuration.getInsecure()) {
      delete filtered.insecure;
      reconcileNeeded = true;
    }
  }

  if (partial.trustedFolders !== undefined && tracker.isExplicitlyChanged(PFLAG.trustedFolders)) {
    const ide = [...configuration.getTrustedFolders()].sort();
    const inc = [...partial.trustedFolders].sort();
    if (!_.isEqual(ide, inc)) {
      delete filtered.trustedFolders;
      reconcileNeeded = true;
    }
  }

  if (partial.cliPath !== undefined && tracker.isExplicitlyChanged(PFLAG.cliPath)) {
    const ide = await configuration.getCliPath();
    if (partial.cliPath !== ide) {
      delete filtered.cliPath;
      reconcileNeeded = true;
    }
  }

  if (partial.manageBinariesAutomatically !== undefined && tracker.isExplicitlyChanged(PFLAG.automaticDownload)) {
    if (partial.manageBinariesAutomatically !== configuration.isAutomaticDependencyManagementEnabled()) {
      delete filtered.manageBinariesAutomatically;
      reconcileNeeded = true;
    }
  }

  if (partial.cliBaseDownloadURL !== undefined && tracker.isExplicitlyChanged(PFLAG.binaryBaseUrl)) {
    if (partial.cliBaseDownloadURL !== configuration.getCliBaseDownloadUrl()) {
      delete filtered.cliBaseDownloadURL;
      reconcileNeeded = true;
    }
  }

  if (partial.filterSeverity !== undefined && tracker.isExplicitlyChanged(PFLAG.enabledSeverities)) {
    if (!_.isEqual(partial.filterSeverity, configuration.severityFilter)) {
      delete filtered.filterSeverity;
      reconcileNeeded = true;
    }
  }

  if (partial.riskScoreThreshold !== undefined && tracker.isExplicitlyChanged(PFLAG.riskScoreThreshold)) {
    if (partial.riskScoreThreshold !== configuration.riskScoreThreshold) {
      delete filtered.riskScoreThreshold;
      reconcileNeeded = true;
    }
  }

  if (partial.token !== undefined && partial.token !== '' && tracker.isExplicitlyChanged(PFLAG.token)) {
    const ide = (await configuration.getToken())?.trim() ?? '';
    const inc = partial.token.trim();
    if (inc !== ide) {
      delete filtered.token;
      reconcileNeeded = true;
    }
  }

  return { filtered, reconcileNeeded };
}
