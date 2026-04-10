import _ from 'lodash';
import { FolderConfig, IConfiguration } from '../configuration/configuration';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import type { LspConfigurationParam, LspConfigSetting } from './types';
import {
  ExplicitChangePredicate,
  LS_KEY,
  folderConfigToLspFolderConfiguration,
  putBoolStr,
  putSetting,
  putStringOrReset,
} from './serverSettingsToLspConfigurationParam';

export class LanguageServerSettings {
  static resolveFolderConfigs(
    configuration: IConfiguration,
    workspace?: Pick<IVSCodeWorkspace, 'getWorkspaceFolders'>,
  ) {
    let folderConfigs = configuration.getFolderConfigs();
    const wsFolders = workspace?.getWorkspaceFolders?.();
    if (folderConfigs.length === 0 && wsFolders?.length) {
      folderConfigs = wsFolders.map(wf => new FolderConfig(wf.uri.fsPath));
    }
    return folderConfigs;
  }

  static async fromConfiguration(
    configuration: IConfiguration,
    isExplicitlyChanged: ExplicitChangePredicate,
    workspace?: Pick<IVSCodeWorkspace, 'getWorkspaceFolders'>,
  ): Promise<LspConfigurationParam> {
    const featuresConfiguration = configuration.getFeaturesConfiguration();
    const m: Record<string, LspConfigSetting> = {};

    // Feature toggles — default to 'true' when undefined
    const featureToggles: [string, boolean | undefined][] = [
      [LS_KEY.snykCodeEnabled, featuresConfiguration?.codeSecurityEnabled],
      [LS_KEY.snykOssEnabled, featuresConfiguration?.ossEnabled],
      [LS_KEY.snykIacEnabled, featuresConfiguration?.iacEnabled],
      [LS_KEY.snykSecretsEnabled, featuresConfiguration?.secretsEnabled],
    ];
    for (const [key, value] of featureToggles) {
      putBoolStr(m, key, _.isUndefined(value) ? 'true' : `${value}`, isExplicitlyChanged);
    }

    putBoolStr(m, LS_KEY.scanNetNew, `${configuration.getDeltaFindingsEnabled()}`, isExplicitlyChanged);
    putBoolStr(m, LS_KEY.sendErrorReports, `${configuration.shouldReportErrors}`, isExplicitlyChanged);
    putBoolStr(m, LS_KEY.trustEnabled, 'true', isExplicitlyChanged);
    putBoolStr(
      m,
      LS_KEY.automaticDownload,
      `${configuration.isAutomaticDependencyManagementEnabled()}`,
      isExplicitlyChanged,
    );
    putBoolStr(m, LS_KEY.proxyInsecure, `${configuration.getInsecure()}`, isExplicitlyChanged);
    putBoolStr(
      m,
      LS_KEY.enableSnykOssQuickFixActions,
      `${configuration.getOssQuickFixCodeActionsEnabled()}`,
      isExplicitlyChanged,
    );
    putBoolStr(m, LS_KEY.autoConfigureMcpServer, `${configuration.getAutoConfigureMcpServer()}`, isExplicitlyChanged);
    putBoolStr(m, LS_KEY.automaticAuthentication, 'false', isExplicitlyChanged);

    putStringOrReset(m, LS_KEY.apiEndpoint, configuration.snykApiEndpoint, isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.binaryBaseUrl, configuration.getCliBaseDownloadUrl(), isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.cliPath, await configuration.getCliPath(), isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.token, await configuration.getToken(), isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.organization, configuration.organization, isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.authenticationMethod, configuration.getAuthenticationMethod(), isExplicitlyChanged);
    putStringOrReset(m, LS_KEY.additionalParameters, configuration.getAdditionalCliParameters(), isExplicitlyChanged);

    const scanningMode = configuration.scanningMode;
    if (scanningMode !== undefined && scanningMode !== '') {
      putSetting(m, LS_KEY.scanAutomatic, scanningMode !== 'manual', isExplicitlyChanged);
    }

    const filterSeverity = configuration.severityFilter;
    if (filterSeverity !== undefined) {
      putSetting(
        m,
        LS_KEY.enabledSeverities,
        {
          critical: filterSeverity.critical,
          high: filterSeverity.high,
          medium: filterSeverity.medium,
          low: filterSeverity.low,
        },
        isExplicitlyChanged,
      );
    }

    const issueViewOptions = configuration.issueViewOptions;
    if (issueViewOptions !== undefined) {
      putSetting(m, LS_KEY.issueViewOpenIssues, issueViewOptions.openIssues, isExplicitlyChanged);
      putSetting(m, LS_KEY.issueViewIgnoredIssues, issueViewOptions.ignoredIssues, isExplicitlyChanged);
    }

    const riskScoreThreshold = configuration.riskScoreThreshold;
    if (riskScoreThreshold != null) {
      putSetting(m, LS_KEY.riskScoreThreshold, riskScoreThreshold, isExplicitlyChanged);
    }

    putSetting(m, LS_KEY.hoverVerbosity, 1, isExplicitlyChanged);
    putSetting(m, LS_KEY.trustedFolders, configuration.getTrustedFolders(), isExplicitlyChanged);
    putStringOrReset(
      m,
      LS_KEY.secureAtInceptionExecutionFreq,
      configuration.getSecureAtInceptionExecutionFrequency(),
      isExplicitlyChanged,
    );

    // Folder configs
    const folderConfigs = LanguageServerSettings.resolveFolderConfigs(configuration, workspace);
    const lspFolderConfigs = folderConfigs.length
      ? folderConfigs.map(fc => folderConfigToLspFolderConfiguration(fc))
      : undefined;

    const result: LspConfigurationParam = { settings: m };
    if (lspFolderConfigs !== undefined) {
      result.folderConfigs = lspFolderConfigs;
    }
    return result;
  }
}
