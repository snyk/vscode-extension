import _ from 'lodash';
import path from 'path';
import { URL } from 'url';
import { SNYK_TOKEN_KEY } from '../constants/general';
import {
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  ADVANCED_ADVANCED_MODE_SETTING,
  ADVANCED_AUTHENTICATION_METHOD,
  ADVANCED_AUTOMATIC_DEPENDENCY_MANAGEMENT,
  ADVANCED_AUTOSCAN_OSS_SETTING,
  ADVANCED_CLI_PATH,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_CUSTOM_LS_PATH,
  ADVANCED_ORGANIZATION,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  DELTA_FINDINGS,
  FEATURES_PREVIEW_SETTING,
  FOLDER_CONFIGS,
  IAC_ENABLED_SETTING,
  ISSUE_VIEW_OPTIONS_SETTING,
  OSS_ENABLED_SETTING,
  SCANNING_MODE,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
  YES_BACKGROUND_OSS_NOTIFICATION_SETTING,
  YES_CRASH_REPORT_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from '../constants/settings';
import SecretStorageAdapter from '../vscode/secretStorage';
import { IVSCodeWorkspace } from '../vscode/workspace';

export type FeaturesConfiguration = {
  ossEnabled: boolean | undefined;
  codeSecurityEnabled: boolean | undefined;
  codeQualityEnabled: boolean | undefined;
  iacEnabled: boolean | undefined;
};

export type FolderConfig = {
  folderPath: string;
  baseBranch: string;
  localBranches: string[] | undefined;
};

export interface IssueViewOptions {
  ignoredIssues: boolean;
  openIssues: boolean;

  [option: string]: boolean;
}

export interface SeverityFilter {
  critical: boolean;
  high: boolean;
  medium: boolean;
  low: boolean;

  [severity: string]: boolean;
}

export type PreviewFeatures = {
  advisor: boolean | undefined;
  ossQuickfixes: boolean | undefined;
};

export interface IConfiguration {
  shouldShowAdvancedView: boolean;
  isDevelopment: boolean;

  authHost: string;

  getFeatureFlag(flagName: string): boolean;

  setFeatureFlag(flagName: string, value: boolean): void;

  getToken(): Promise<string | undefined>;

  setToken(token: string | undefined): Promise<void>;

  getAuthenticationMethod(): string;

  setCliPath(cliPath: string): Promise<void>;

  clearToken(): Promise<void>;

  snykCodeUrl: string;

  organization: string | undefined;

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

  getCliPath(): string | undefined;

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

  getFolderConfigs(): FolderConfig[];

  setFolderConfigs(folderConfig: FolderConfig[]): Promise<void>;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  private readonly defaultSnykCodeBaseURL = 'https://deeproxy.snyk.io';
  private readonly defaultAuthHost = 'https://app.snyk.io';
  private readonly defaultApiEndpoint = 'https://api.snyk.io';

  private featureFlag: { [key: string]: boolean } = {};

  constructor(private processEnv: NodeJS.ProcessEnv = process.env, private workspace: IVSCodeWorkspace) {}

  getInsecure(): boolean {
    const strictSSL = this.workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
    return !strictSSL;
  }

  static async getVersion(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { version } = await this.getPackageJsonConfig();
    return version;
  }

  static async isPreview(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  getSnykLanguageServerPath(): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CUSTOM_LS_PATH),
    );
  }

  getDeltaFindingsEnabled(): boolean {
    return (
      this.workspace.getConfiguration<boolean>(CONFIGURATION_IDENTIFIER, this.getConfigName(DELTA_FINDINGS)) ?? false
    );
  }

  getAuthenticationMethod(): string {
    const setting = this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_AUTHENTICATION_METHOD),
    );
    if (setting?.toLowerCase() != 'token authentication') {
      return 'oauth';
    } else {
      return 'token';
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
    if (!cliPath) return;
    return this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_CLI_PATH),
      cliPath,
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
    const codeQualityEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(CODE_QUALITY_ENABLED_SETTING),
    );
    const iacEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(IAC_ENABLED_SETTING),
    );

    if (
      _.isUndefined(ossEnabled) &&
      _.isUndefined(codeSecurityEnabled) &&
      _.isUndefined(codeQualityEnabled) &&
      _.isUndefined(iacEnabled)
    ) {
      // TODO: return 'undefined' to render feature selection screen once OSS integration is available
      return { ossEnabled: true, codeSecurityEnabled: true, codeQualityEnabled: true, iacEnabled: true };
    }

    return {
      ossEnabled,
      codeSecurityEnabled,
      codeQualityEnabled,
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
      this.getConfigName(CODE_QUALITY_ENABLED_SETTING),
      config?.codeQualityEnabled,
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

    return (
      config ?? {
        openIssues: true,
        ignoredIssues: true,
      }
    );
  }

  get severityFilter(): SeverityFilter {
    const config = this.workspace.getConfiguration<SeverityFilter>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(SEVERITY_FILTER_SETTING),
    );

    return (
      config ?? {
        critical: true,
        high: true,
        medium: true,
        low: true,
      }
    );
  }

  get organization(): string | undefined {
    return this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, this.getConfigName(ADVANCED_ORGANIZATION));
  }

  getPreviewFeatures(): PreviewFeatures {
    const defaultSetting: PreviewFeatures = {
      advisor: false,
      ossQuickfixes: false,
    };

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

  getCliPath(): string | undefined {
    return this.workspace.getConfiguration<string>(CONFIGURATION_IDENTIFIER, this.getConfigName(ADVANCED_CLI_PATH));
  }

  getTrustedFolders(): string[] {
    return (
      this.workspace.getConfiguration<string[]>(CONFIGURATION_IDENTIFIER, this.getConfigName(TRUSTED_FOLDERS)) || []
    );
  }

  getFolderConfigs(): FolderConfig[] {
    return (
      this.workspace.getConfiguration<FolderConfig[]>(CONFIGURATION_IDENTIFIER, this.getConfigName(FOLDER_CONFIGS)) ||
      []
    );
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
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(FOLDER_CONFIGS),
      folderConfigs,
      true,
    );
  }

  private getConfigName = (setting: string) => setting.replace(`${CONFIGURATION_IDENTIFIER}.`, '');
}
