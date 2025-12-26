import _ from 'lodash';
import path from 'path';
import { URL } from 'url';
import { CliExecutable } from '../../cli/cliExecutable';
import { SNYK_TOKEN_KEY } from '../constants/general';
import {
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  ADVANCED_ADVANCED_MODE_SETTING,
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_AUTO_SELECT_ORGANIZATION,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_AUTOSCAN_OSS_SETTING,
  ADVANCED_CLI_BASE_DOWNLOAD_URL,
  ADVANCED_CLI_PATH,
  ADVANCED_CLI_RELEASE_CHANNEL,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_CUSTOM_LS_PATH,
  ADVANCED_ORGANIZATION,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  DELTA_FINDINGS,
  FEATURES_PREVIEW_SETTING,
  FOLDER_CONFIGS,
  IAC_ENABLED_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  OSS_ENABLED_SETTING,
  RISK_SCORE_THRESHOLD_SETTING,
  SCANNING_MODE,
  AUTO_CONFIGURE_MCP_SERVER,
  SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
  YES_CRASH_REPORT_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from '../constants/settings';
import SecretStorageAdapter from '../vscode/secretStorage';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { WorkspaceFolder } from '../vscode/types';

export const NEWISSUES = 'Net new issues';
export const ALLISSUES = 'All issues';

export type FeaturesConfiguration = {
  ossEnabled: boolean | undefined;
  codeSecurityEnabled: boolean | undefined;
  iacEnabled: boolean | undefined;
};

export type ScanCommandConfig = {
  preScanCommand: string;
  preScanOnlyReferenceFolder: boolean;
  postScanCommand: string;
  postScanOnlyReferenceFolder: boolean;
};

export type LocalCodeEngine = {
  allowCloudUpload: boolean;
  url: string;
  enabled: boolean;
};

export type SastSettings = {
  sastEnabled: boolean;
  localCodeEngine: LocalCodeEngine;
  org: string;
  supportedLanguages: string[];
  reportFalsePositivesEnabled: boolean;
  autofixEnabled: boolean;
};

export type FolderConfig = {
  folderPath: string;
  baseBranch: string;
  localBranches: string[] | undefined;
  referenceFolderPath: string | undefined;
  scanCommandConfig?: Record<string, ScanCommandConfig>;
  featureFlags?: Record<string, boolean>;
  orgSetByUser: boolean;
  preferredOrg: string;
  autoDeterminedOrg: string;
  orgMigratedFromGlobalConfig: boolean;
  sastSettings?: SastSettings;
};

export interface IssueViewOptions {
  ignoredIssues: boolean;
  openIssues: boolean;

  [option: string]: boolean;
}

export const DEFAULT_ISSUE_VIEW_OPTIONS: IssueViewOptions = {
  ignoredIssues: true,
  openIssues: true,
};

export const DEFAULT_RISK_SCORE_THRESHOLD = 0; // Should match value in package.json.

export interface SeverityFilter {
  critical: boolean;
  high: boolean;
  medium: boolean;
  low: boolean;

  [severity: string]: boolean;
}

export const DEFAULT_SEVERITY_FILTER: SeverityFilter = {
  critical: true,
  high: true,
  medium: true,
  low: true,
};

const DEFAULT_AUTO_ORGANIZATION = false; // Should match value in package.json.

export const DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY = 'Manual';

export type PreviewFeatures = Record<string, never>;

export interface IConfiguration {
  shouldShowAdvancedView: boolean;
  isDevelopment: boolean;

  authHost: string;

  getExtensionId(): string;

  setExtensionId(extensionId: string): void;

  getFeatureFlag(flagName: string): boolean;

  setFeatureFlag(flagName: string, value: boolean): void;

  getPreviewFeature(featureName: string): boolean;

  getToken(): Promise<string | undefined>;

  setToken(token: string | undefined): Promise<void>;

  getAuthenticationMethod(): string;

  setCliPath(cliPath: string): Promise<void>;

  setCliReleaseChannel(releaseChannel: string): Promise<void>;

  setCliBaseDownloadUrl(baseDownloadUrl: string): Promise<void>;

  clearToken(): Promise<void>;

  snykCodeUrl: string;

  /**
   * Gets the organization setting from the global & workspace scopes only.
   */
  organization: string | undefined;

  /**
   * Gets the auto organization setting for a workspace folder, considering all levels (folder, workspace, global, default).
   * @param workspaceFolder - The workspace folder to check the setting for
   * @returns true if auto organization is enabled, false otherwise
   */
  isAutoSelectOrganizationEnabled(workspaceFolder: WorkspaceFolder): boolean;

  /**
   * Sets the auto organization setting at the workspace folder level.
   * @param workspaceFolder - The workspace folder to set the setting for
   * @param autoSelectOrganization - Whether auto organization should be enabled
   */
  setAutoSelectOrganization(workspaceFolder: WorkspaceFolder, autoSelectOrganization: boolean): Promise<void>;

  /**
   * Gets the organization setting for a workspace folder, considering all levels (folder, workspace, global, default).
   * @param workspaceFolder - The workspace folder to check the setting for
   * @returns The organization ID/name, or undefined if not set
   */
  getOrganization(workspaceFolder: WorkspaceFolder): string | undefined;

  /**
   * Gets the organization setting ONLY at the workspace folder level (no fallback to workspace/global).
   * @param workspaceFolder - The workspace folder to check the setting for
   * @returns The organization ID/name set specifically at folder level, or undefined if not set at folder level
   */
  getOrganizationAtWorkspaceFolderLevel(workspaceFolder: WorkspaceFolder): string | undefined;

  /**
   * Sets the organization at the workspace folder level.
   * If the empty string or undefined is provided, the organization will be cleared.
   * @param workspaceFolder - The workspace folder to set the organization for
   * @param organization - The organization ID/name to set, or undefined to clear
   */
  setOrganization(workspaceFolder: WorkspaceFolder, organization?: string): Promise<void>;

  getAdditionalCliParameters(): string | undefined;

  snykApiEndpoint: string;

  shouldAutoScanOss: boolean;

  shouldReportErrors: boolean;
  shouldShowWelcomeNotification: boolean;

  hideWelcomeNotification(): Promise<void>;

  getFeaturesConfiguration(): FeaturesConfiguration;

  setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void>;

  getPreviewFeatures(): PreviewFeatures;

  isAutomaticDependencyManagementEnabled(): boolean;

  getCliPath(): Promise<string>;

  getCliReleaseChannel(): Promise<string>;

  getCliBaseDownloadUrl(): string;

  getInsecure(): boolean;

  isFedramp: boolean;

  issueViewOptions: IssueViewOptions;

  riskScoreThreshold: number;

  severityFilter: SeverityFilter;

  scanningMode: string | undefined;

  getSnykLanguageServerPath(): string | undefined;

  getTrustedFolders(): string[];

  setTrustedFolders(trustedFolders: string[]): Promise<void>;

  setEndpoint(endpoint: string): Promise<void>;

  getDeltaFindingsEnabled(): boolean;

  setDeltaFindingsEnabled(isEnabled: boolean): Promise<void>;

  getOssQuickFixCodeActionsEnabled(): boolean;

  getFolderConfigs(): FolderConfig[];

  setFolderConfigs(folderConfig: FolderConfig[]): Promise<void>;

  getConfigurationAtFolderLevelOnly<T>(configSettingName: string, workspaceFolder: WorkspaceFolder): T | undefined;

  getSecureAtInceptionExecutionFrequency(): string;

  setSecureAtInceptionExecutionFrequency(frequency: string): Promise<void>;

  getAutoConfigureMcpServer(): boolean;

  setAutoConfigureMcpServer(autoConfigureMcpServer: boolean): Promise<void>;
}

export class Configuration implements IConfiguration {
  private readonly defaultAuthHost = 'https://app.snyk.io';
  private readonly defaultApiEndpoint = 'https://api.snyk.io';
  private readonly defaultCliBaseDownloadUrl = 'https://downloads.snyk.io';
  private readonly defaultCliReleaseChannel = 'stable';

  private featureFlag: { [key: string]: boolean } = {};
  private extensionId: string;
  private inMemoryFolderConfigs: FolderConfig[] = [];

  constructor(private processEnv: NodeJS.ProcessEnv = process.env, private workspace: IVSCodeWorkspace) {}

  getExtensionId(): string {
    return this.extensionId;
  }

  setExtensionId(extensionId: string): void {
    this.extensionId = extensionId;
  }

  async setCliReleaseChannel(releaseChannel: string): Promise<void> {
    if (!releaseChannel) return;
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_RELEASE_CHANNEL);
    return this.workspace.updateConfiguration(configurationId, section, releaseChannel, true);
  }

  async setCliBaseDownloadUrl(baseDownloadUrl: string): Promise<void> {
    if (!baseDownloadUrl) return;
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_BASE_DOWNLOAD_URL);
    return this.workspace.updateConfiguration(configurationId, section, baseDownloadUrl, true);
  }

  getAutoConfigureMcpServer(): boolean {
    const { configurationId, section } = Configuration.getConfigName(AUTO_CONFIGURE_MCP_SERVER);
    const value = this.workspace.getConfiguration<boolean>(configurationId, section);
    return value ?? false;
  }

  getSecureAtInceptionExecutionFrequency(): string {
    const { configurationId, section } = Configuration.getConfigName(SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY);
    const value = this.workspace.getConfiguration<string>(configurationId, section);

    return value ?? 'Manual';
  }

  async getCliReleaseChannel(): Promise<string> {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_RELEASE_CHANNEL);
    let releaseChannel = this.workspace.getConfiguration<string>(configurationId, section);
    const extensionId = this.getExtensionId();
    // If Extension is preview and has default value of release Channel we override it to preview.
    if (extensionId && extensionId.includes('preview') && releaseChannel === this.defaultCliReleaseChannel) {
      await this.setCliReleaseChannel('preview');
      releaseChannel = 'preview';
    } else if (!releaseChannel) {
      releaseChannel = this.defaultCliReleaseChannel;
    }
    return releaseChannel;
  }

  getCliBaseDownloadUrl(): string {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_BASE_DOWNLOAD_URL);
    return this.workspace.getConfiguration<string>(configurationId, section) ?? this.defaultCliBaseDownloadUrl;
  }

  getOssQuickFixCodeActionsEnabled(): boolean {
    return true;
  }

  getSnykLanguageServerPath(): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CUSTOM_LS_PATH);
    return this.workspace.getConfiguration<string>(configurationId, section);
  }

  getInsecure(): boolean {
    const strictSSL = this.workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
    return !strictSSL;
  }

  static async getVersion(): Promise<string> {
    const { version } = await this.getPackageJsonConfig();
    return version;
  }

  static async isPreview(): Promise<boolean> {
    const { preview } = await this.getPackageJsonConfig();
    return preview;
  }

  getFeatureFlag(flagName: string): boolean {
    return this.featureFlag[flagName] ?? false;
  }

  setFeatureFlag(flagName: string, value: boolean): void {
    this.featureFlag[flagName] = value;
  }

  getPreviewFeature(featureName: string): boolean {
    const previewFeatures =
      this.workspace.getConfiguration<Record<string, boolean>>(CONFIGURATION_IDENTIFIER, 'features.preview') ?? {};
    return previewFeatures[featureName] ?? false;
  }

  private static async getPackageJsonConfig(): Promise<{
    version: string;
    preview: boolean;
  }> {
    return (await import(path.join('../../../..', 'package.json'))) as {
      version: string;
      preview: boolean;
    };
  }

  get isDevelopment(): boolean {
    return !!this.processEnv.SNYK_VSCE_DEVELOPMENT;
  }

  private get customEndpoint(): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CUSTOM_ENDPOINT);
    return this.workspace.getConfiguration<string>(configurationId, section);
  }

  get authHost(): string {
    if (this.customEndpoint) {
      const url = new URL(this.customEndpoint);
      url.host = url.host.replace('api', 'app');
      return `${url.protocol}//${url.host}`;
    }

    return this.defaultAuthHost;
  }

  async setEndpoint(endpoint: string): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CUSTOM_ENDPOINT);
    await this.workspace.updateConfiguration(configurationId, section, endpoint.toString(), true);
  }

  get isFedramp(): boolean {
    if (!this.customEndpoint) return false;

    // FEDRAMP URL e.g. https://api.feddramp.snykgov.io
    const endpoint = new URL(this.customEndpoint);

    // hostname validation
    const hostnameParts = endpoint.hostname.split('.');
    if (hostnameParts.length < 3) return false;

    return `${hostnameParts[2]}.${hostnameParts[3]}`.includes('snykgov.io');
  }

  get snykApiEndpoint(): string {
    if (this.customEndpoint) {
      return this.customEndpoint;
    }

    return this.defaultApiEndpoint;
  }

  get snykCodeUrl(): string {
    const authUrl = new URL(this.authHost);
    return `${authUrl.toString()}manage/snyk-code?from=vscode`;
  }

  getDeltaFindingsEnabled(): boolean {
    const { configurationId, section } = Configuration.getConfigName(DELTA_FINDINGS);
    const value = this.workspace.getConfiguration<string>(configurationId, section);
    return value === NEWISSUES;
  }

  getAuthenticationMethod(): string {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTHENTICATION_METHOD);
    const setting = this.workspace.getConfiguration<string>(configurationId, section);
    const authMethod = setting?.toLowerCase() ?? '';
    if (authMethod === 'api token (legacy)') {
      return 'token';
    } else if (authMethod === 'personal access token') {
      return 'pat';
    } else {
      return 'oauth';
    }
  }

  async getToken(): Promise<string | undefined> {
    return new Promise(resolve => {
      SecretStorageAdapter.instance
        .get(SNYK_TOKEN_KEY)
        .then(token => resolve(token))
        .catch(async _ => {
          // clear the token and return empty string
          await this.clearToken();
          resolve('');
        });
    });
  }

  async setToken(token: string | undefined): Promise<void> {
    if (!token) return;
    return await SecretStorageAdapter.instance.store(SNYK_TOKEN_KEY, token);
  }

  async setCliPath(cliPath: string | undefined): Promise<void> {
    if (!cliPath) {
      cliPath = await CliExecutable.getPath();
    }
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_PATH);
    return this.workspace.updateConfiguration(configurationId, section, cliPath, true);
  }

  async setDeltaFindingsEnabled(isEnabled: boolean): Promise<void> {
    let deltaValue = NEWISSUES;
    if (!isEnabled) {
      deltaValue = ALLISSUES;
    }
    const { configurationId, section } = Configuration.getConfigName(DELTA_FINDINGS);
    await this.workspace.updateConfiguration(configurationId, section, deltaValue, true);
  }

  async clearToken(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      SecretStorageAdapter.instance
        .delete(SNYK_TOKEN_KEY)
        .then(() => resolve())
        .catch(error => {
          reject(error);
        });
    });
  }

  getFeaturesConfiguration(): FeaturesConfiguration {
    const { configurationId: ossConfigId, section: ossSection } = Configuration.getConfigName(OSS_ENABLED_SETTING);
    const ossEnabled = this.workspace.getConfiguration<boolean>(ossConfigId, ossSection);

    const { configurationId: codeConfigId, section: codeSection } =
      Configuration.getConfigName(CODE_SECURITY_ENABLED_SETTING);
    const codeSecurityEnabled = this.workspace.getConfiguration<boolean>(codeConfigId, codeSection);

    const { configurationId: iacConfigId, section: iacSection } = Configuration.getConfigName(IAC_ENABLED_SETTING);
    const iacEnabled = this.workspace.getConfiguration<boolean>(iacConfigId, iacSection);

    if (_.isUndefined(ossEnabled) && _.isUndefined(codeSecurityEnabled) && _.isUndefined(iacEnabled)) {
      // TODO: return 'undefined' to render feature selection screen once OSS integration is available
      return { ossEnabled: true, codeSecurityEnabled: true, iacEnabled: true };
    }

    return {
      ossEnabled,
      codeSecurityEnabled,
      iacEnabled,
    };
  }

  async setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void> {
    const { configurationId: ossConfigId, section: ossSection } = Configuration.getConfigName(OSS_ENABLED_SETTING);
    await this.workspace.updateConfiguration(ossConfigId, ossSection, config?.ossEnabled, true);

    const { configurationId: codeConfigId, section: codeSection } =
      Configuration.getConfigName(CODE_SECURITY_ENABLED_SETTING);
    await this.workspace.updateConfiguration(codeConfigId, codeSection, config?.codeSecurityEnabled, true);

    const { configurationId: iacConfigId, section: iacSection } = Configuration.getConfigName(IAC_ENABLED_SETTING);
    await this.workspace.updateConfiguration(iacConfigId, iacSection, config?.iacEnabled, true);
  }

  get shouldReportErrors(): boolean {
    const { configurationId, section } = Configuration.getConfigName(YES_CRASH_REPORT_SETTING);
    return !!this.workspace.getConfiguration<boolean>(configurationId, section);
  }

  get shouldShowWelcomeNotification(): boolean {
    const { configurationId, section } = Configuration.getConfigName(YES_WELCOME_NOTIFICATION_SETTING);
    return !!this.workspace.getConfiguration<boolean>(configurationId, section);
  }

  async hideWelcomeNotification(): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(YES_WELCOME_NOTIFICATION_SETTING);
    await this.workspace.updateConfiguration(configurationId, section, false, true);
  }

  get shouldShowAdvancedView(): boolean {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ADVANCED_MODE_SETTING);
    return !!this.workspace.getConfiguration<boolean>(configurationId, section);
  }

  get shouldAutoScanOss(): boolean {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTOSCAN_OSS_SETTING);
    return !!this.workspace.getConfiguration<boolean>(configurationId, section);
  }

  get issueViewOptions(): IssueViewOptions {
    const { configurationId, section } = Configuration.getConfigName(ISSUE_VIEW_OPTIONS_SETTING);
    const config = this.workspace.getConfiguration<IssueViewOptions>(configurationId, section);

    return config ?? DEFAULT_ISSUE_VIEW_OPTIONS;
  }

  get riskScoreThreshold(): number {
    const { configurationId, section } = Configuration.getConfigName(RISK_SCORE_THRESHOLD_SETTING);
    return this.workspace.getConfiguration<number>(configurationId, section) ?? DEFAULT_RISK_SCORE_THRESHOLD;
  }

  get severityFilter(): SeverityFilter {
    const { configurationId, section } = Configuration.getConfigName(SEVERITY_FILTER_SETTING);
    const config = this.workspace.getConfiguration<SeverityFilter>(configurationId, section);

    return config ?? DEFAULT_SEVERITY_FILTER;
  }

  isAutoSelectOrganizationEnabled(workspaceFolder: WorkspaceFolder): boolean {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTO_SELECT_ORGANIZATION);
    return (
      this.workspace.getConfiguration<boolean>(configurationId, section, workspaceFolder) ?? DEFAULT_AUTO_ORGANIZATION
    );
  }

  async setAutoSelectOrganization(workspaceFolder: WorkspaceFolder, autoSelectOrganization: boolean): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTO_SELECT_ORGANIZATION);
    await this.workspace.updateConfiguration(configurationId, section, autoSelectOrganization, workspaceFolder);
  }

  get organization(): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    return this.workspace.getConfiguration<string>(configurationId, section);
  }

  getOrganization(workspaceFolder: WorkspaceFolder): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    return this.workspace.getConfiguration<string>(configurationId, section, workspaceFolder);
  }

  getOrganizationAtWorkspaceFolderLevel(workspaceFolder: WorkspaceFolder): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    return this.workspace.inspectConfiguration<string>(configurationId, section, workspaceFolder)?.workspaceFolderValue;
  }

  async setOrganization(workspaceFolder: WorkspaceFolder, organization?: string): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ORGANIZATION);
    await this.workspace.updateConfiguration(
      configurationId,
      section,
      organization === '' ? undefined : organization,
      workspaceFolder,
    );
  }

  getPreviewFeatures(): PreviewFeatures {
    const defaultSetting: PreviewFeatures = {};

    const { configurationId, section } = Configuration.getConfigName(FEATURES_PREVIEW_SETTING);
    const userSetting = this.workspace.getConfiguration<PreviewFeatures>(configurationId, section) || {};

    return {
      ...defaultSetting,
      ...userSetting,
    };
  }

  getAdditionalCliParameters(): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_ADDITIONAL_PARAMETERS_SETTING);
    return this.workspace.getConfiguration<string>(configurationId, section);
  }

  isAutomaticDependencyManagementEnabled(): boolean {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT);
    return !!this.workspace.getConfiguration<boolean>(configurationId, section);
  }

  async getCliPath(): Promise<string> {
    const { configurationId, section } = Configuration.getConfigName(ADVANCED_CLI_PATH);
    let cliPath = this.workspace.getConfiguration<string>(configurationId, section);
    if (!cliPath) {
      cliPath = await this.determineCliPath();
      await this.setCliPath(cliPath);
    }
    return cliPath;
  }

  async determineCliPath(): Promise<string> {
    // if CLI Path is empty and Automatic Dependency management is disabled
    // But Snyk-LS path is set, we will set CLI Path to Snyk LS path.
    // This is a workaround that should be removed after the release of v2.20.0
    const isAutomaticDependencyManagementEnabled = this.isAutomaticDependencyManagementEnabled();
    const snykLsPath = this.getSnykLanguageServerPath();
    if (!isAutomaticDependencyManagementEnabled && snykLsPath) return snykLsPath;
    return await CliExecutable.getPath();
  }

  getTrustedFolders(): string[] {
    const { configurationId, section } = Configuration.getConfigName(TRUSTED_FOLDERS);
    return this.workspace.getConfiguration<string[]>(configurationId, section) || [];
  }

  getFolderConfigs(): FolderConfig[] {
    return this.inMemoryFolderConfigs;
  }

  get scanningMode(): string | undefined {
    const { configurationId, section } = Configuration.getConfigName(SCANNING_MODE);
    return this.workspace.getConfiguration<string>(configurationId, section);
  }

  async setTrustedFolders(trustedFolders: string[]): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(TRUSTED_FOLDERS);
    await this.workspace.updateConfiguration(configurationId, section, trustedFolders, true);
  }

  async setFolderConfigs(folderConfigs: FolderConfig[]): Promise<void> {
    this.inMemoryFolderConfigs = folderConfigs;
    const { configurationId, section } = Configuration.getConfigName(FOLDER_CONFIGS);
    await this.workspace.updateConfiguration(configurationId, section, this.inMemoryFolderConfigs, true);
  }

  /**
   * Gets a configuration setting ONLY at the workspace folder level (no fallback to workspace/global).
   * Returns undefined if the setting is not specifically set at the folder level.
   */
  getConfigurationAtFolderLevelOnly<T>(configSettingName: string, workspaceFolder: WorkspaceFolder): T | undefined {
    const { configurationId, section } = Configuration.getConfigName(configSettingName);
    const inspectionResult = this.workspace.inspectConfiguration<T>(configurationId, section, workspaceFolder);
    return inspectionResult?.workspaceFolderValue;
  }

  /**
   * Parses a setting key to extract configuration identifier and setting name.
   * @param settingKey - The full setting key (e.g., 'snyk.advanced.cliPath')
   * @returns An object with configurationId and section (setting name without prefix)
   */
  public static getConfigName(settingKey: string): { configurationId: string; section: string } {
    const parts = settingKey.split('.');
    const configurationId = parts[0];
    const section = parts.slice(1).join('.');
    return { configurationId, section };
  }

  async setSecureAtInceptionExecutionFrequency(frequency: string): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY);
    await this.workspace.updateConfiguration(configurationId, section, frequency, true);
  }

  async setAutoConfigureMcpServer(autoConfigureMcpServer: boolean): Promise<void> {
    const { configurationId, section } = Configuration.getConfigName(AUTO_CONFIGURE_MCP_SERVER);
    await this.workspace.updateConfiguration(configurationId, section, autoConfigureMcpServer, true);
  }
}
