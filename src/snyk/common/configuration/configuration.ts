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
  SCANNING_MODE,
  AUTO_CONFIGURE_MCP_SERVER,
  SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
  YES_BACKGROUND_OSS_NOTIFICATION_SETTING,
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

export type FolderConfig = {
  folderPath: string;
  baseBranch: string;
  localBranches: string[] | undefined;
  referenceFolderPath: string | undefined;
  scanCommandConfig?: Record<string, ScanCommandConfig>;
  orgSetByUser: boolean;
  preferredOrg: string;
  autoDeterminedOrg: string;
  orgMigratedFromGlobalConfig: boolean;
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

export const DEFAULT_SECURE_AT_INCEPTION_EXECUTION_FREQUENCY = 'Manual';

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

export type PreviewFeatures = Record<string, never>;

export interface IConfiguration {
  shouldShowAdvancedView: boolean;
  isDevelopment: boolean;

  authHost: string;

  getExtensionId(): string;

  setExtensionId(extensionId: string): void;

  getFeatureFlag(flagName: string): boolean;

  setFeatureFlag(flagName: string, value: boolean): void;

  getToken(): Promise<string | undefined>;

  setToken(token: string | undefined): Promise<void>;

  getAuthenticationMethod(): string;

  setCliPath(cliPath: string): Promise<void>;

  setCliReleaseChannel(releaseChannel: string): Promise<void>;

  setCliBaseDownloadUrl(baseDownloadUrl: string): Promise<void>;

  clearToken(): Promise<void>;

  snykCodeUrl: string;

  organization: string | undefined;

  isAutoSelectOrganizationEnabled(workspaceFolder: WorkspaceFolder): boolean;

  setAutoSelectOrganization(workspaceFolder: WorkspaceFolder, autoSelectOrganization: boolean): Promise<void>;

  getOrganization(workspaceFolder: WorkspaceFolder): string | undefined;

  getOrganizationAtWorkspaceFolderLevel(workspaceFolder: WorkspaceFolder): string | undefined;

  setOrganization(workspaceFolder: WorkspaceFolder, organization?: string): Promise<void>;

  getAdditionalCliParameters(): string | undefined;

  snykApiEndpoint: string;
  shouldShowOssBackgroundScanNotification: boolean;

  hideOssBackgroundScanNotification(): Promise<void>;

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
    return this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_RELEASE_CHANNEL),
      releaseChannel,
      true,
    );
  }

  async setCliBaseDownloadUrl(baseDownloadUrl: string): Promise<void> {
    if (!baseDownloadUrl) return;
    return this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_BASE_DOWNLOAD_URL),
      baseDownloadUrl,
      true,
    );
  }

  getAutoConfigureMcpServer(): boolean {
    const value = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(AUTO_CONFIGURE_MCP_SERVER),
    );
    return value ?? false;
  }

  getSecureAtInceptionExecutionFrequency(): string {
    const value = this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY),
    );

    return value ?? 'Manual';
  }

  async getCliReleaseChannel(): Promise<string> {
    let releaseChannel = this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_RELEASE_CHANNEL),
    );
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
    return (
      this.workspace.getConfiguration<string>(
        CONFIGURATION_IDENTIFIER,
        this.getConfigName(ADVANCED_CLI_BASE_DOWNLOAD_URL),
      ) ?? this.defaultCliBaseDownloadUrl
    );
  }

  getOssQuickFixCodeActionsEnabled(): boolean {
    return true;
  }

  getSnykLanguageServerPath(): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CUSTOM_LS_PATH),
    );
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

  private static async getPackageJsonConfig(): Promise<{ version: string; preview: boolean }> {
    return (await import(path.join('../../../..', 'package.json'))) as { version: string; preview: boolean };
  }

  get isDevelopment(): boolean {
    return !!this.processEnv.SNYK_VSCE_DEVELOPMENT;
  }

  private get customEndpoint(): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CUSTOM_ENDPOINT),
    );
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
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CUSTOM_ENDPOINT),
      endpoint.toString(),
      true,
    );
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
    const value = this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, this.getConfigName(DELTA_FINDINGS));
    return value === NEWISSUES;
  }

  getAuthenticationMethod(): string {
    const setting = this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_AUTHENTICATION_METHOD),
    );
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
    return this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_PATH),
      cliPath,
      true,
    );
  }

  async setDeltaFindingsEnabled(isEnabled: boolean): Promise<void> {
    let deltaValue = NEWISSUES;
    if (!isEnabled) {
      deltaValue = ALLISSUES;
    }
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(DELTA_FINDINGS),
      deltaValue,
      true,
    );
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
    const ossEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(OSS_ENABLED_SETTING),
    );
    const codeSecurityEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(CODE_SECURITY_ENABLED_SETTING),
    );
    const iacEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(IAC_ENABLED_SETTING),
    );

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
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(OSS_ENABLED_SETTING),
      config?.ossEnabled,
      true,
    );
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(CODE_SECURITY_ENABLED_SETTING),
      config?.codeSecurityEnabled,
      true,
    );
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(IAC_ENABLED_SETTING),
      config?.iacEnabled,
      true,
    );
  }

  get shouldReportErrors(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_CRASH_REPORT_SETTING),
    );
  }

  get shouldShowWelcomeNotification(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_WELCOME_NOTIFICATION_SETTING),
    );
  }

  async hideWelcomeNotification(): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_WELCOME_NOTIFICATION_SETTING),
      false,
      true,
    );
  }

  get shouldShowOssBackgroundScanNotification(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_BACKGROUND_OSS_NOTIFICATION_SETTING),
    );
  }

  async hideOssBackgroundScanNotification(): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_BACKGROUND_OSS_NOTIFICATION_SETTING),
      false,
      true,
    );
  }

  get shouldShowAdvancedView(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ADVANCED_MODE_SETTING),
    );
  }

  get shouldAutoScanOss(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_AUTOSCAN_OSS_SETTING),
    );
  }

  get issueViewOptions(): IssueViewOptions {
    const config = this.workspace.getConfiguration<IssueViewOptions>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ISSUE_VIEW_OPTIONS_SETTING),
    );

    return config ?? DEFAULT_ISSUE_VIEW_OPTIONS;
  }

  get severityFilter(): SeverityFilter {
    const config = this.workspace.getConfiguration<SeverityFilter>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(SEVERITY_FILTER_SETTING),
    );

    return config ?? DEFAULT_SEVERITY_FILTER;
  }

  /**
   * Gets the auto organization setting for a workspace folder, considering all levels (folder, workspace, global, default).
   */
  isAutoSelectOrganizationEnabled(workspaceFolder: WorkspaceFolder): boolean {
    return (
      this.workspace.getConfiguration<boolean>(
        CONFIGURATION_IDENTIFIER,
        this.getConfigName(ADVANCED_AUTO_SELECT_ORGANIZATION),
        workspaceFolder,
      ) ?? DEFAULT_AUTO_ORGANIZATION
    );
  }

  /**
   * Sets the auto organization setting at the workspace folder level.
   */
  async setAutoSelectOrganization(workspaceFolder: WorkspaceFolder, autoSelectOrganization: boolean): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_AUTO_SELECT_ORGANIZATION),
      autoSelectOrganization,
      workspaceFolder,
    );
  }

  /**
   * Gets the organization setting from the global & workspace scopes only.
   */
  get organization(): string | undefined {
    return this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, this.getConfigName(ADVANCED_ORGANIZATION));
  }

  getOrganization(workspaceFolder: WorkspaceFolder): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ORGANIZATION),
      workspaceFolder,
    );
  }

  getOrganizationAtWorkspaceFolderLevel(workspaceFolder: WorkspaceFolder): string | undefined {
    return this.workspace.inspectConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ORGANIZATION),
      workspaceFolder,
    )?.workspaceFolderValue;
  }

  /**
   * Sets the organization at the workspace folder level.
   * If the empty string or undefined is provided, the organization will be cleared.
   */
  async setOrganization(workspaceFolder: WorkspaceFolder, organization?: string): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ORGANIZATION),
      organization === '' ? undefined : organization,
      workspaceFolder,
    );
  }

  getPreviewFeatures(): PreviewFeatures {
    const defaultSetting: PreviewFeatures = {};

    const userSetting =
      this.workspace.getConfiguration<PreviewFeatures>(
        CONFIGURATION_IDENTIFIER,
        this.getConfigName(FEATURES_PREVIEW_SETTING),
      ) || {};

    return {
      ...defaultSetting,
      ...userSetting,
    };
  }

  getAdditionalCliParameters(): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ADDITIONAL_PARAMETERS_SETTING),
    );
  }

  isAutomaticDependencyManagementEnabled(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT),
    );
  }

  async getCliPath(): Promise<string> {
    let cliPath = this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_PATH),
    );
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
    return (
      this.workspace.getConfiguration<string[]>(CONFIGURATION_IDENTIFIER, this.getConfigName(TRUSTED_FOLDERS)) || []
    );
  }

  getFolderConfigs(): FolderConfig[] {
    return this.inMemoryFolderConfigs;
  }

  get scanningMode(): string | undefined {
    return this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, this.getConfigName(SCANNING_MODE));
  }

  async setTrustedFolders(trustedFolders: string[]): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(TRUSTED_FOLDERS),
      trustedFolders,
      true,
    );
  }

  async setFolderConfigs(folderConfigs: FolderConfig[]): Promise<void> {
    this.inMemoryFolderConfigs = folderConfigs;
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(FOLDER_CONFIGS),
      this.inMemoryFolderConfigs,
      true,
    );
  }

  /**
   * Gets a configuration setting ONLY at the workspace folder level (no fallback to workspace/global).
   * Returns undefined if the setting is not specifically set at the folder level.
   */
  getConfigurationAtFolderLevelOnly<T>(configSettingName: string, workspaceFolder: WorkspaceFolder): T | undefined {
    const inspectionResult = this.workspace.inspectConfiguration<T>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(configSettingName),
      workspaceFolder,
    );
    return inspectionResult?.workspaceFolderValue;
  }

  private getConfigName = (setting: string) => setting.replace(`${CONFIGURATION_IDENTIFIER}.`, '');

  async setSecureAtInceptionExecutionFrequency(frequency: string): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(SECURITY_AT_INCEPTION_EXECUTION_FREQUENCY),
      frequency,
      true,
    );
  }

  async setAutoConfigureMcpServer(autoConfigureMcpServer: boolean): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(AUTO_CONFIGURE_MCP_SERVER),
      autoConfigureMcpServer,
      true,
    );
  }
}
