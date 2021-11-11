import _ from 'lodash';
import path from 'path';
import { URL } from 'url';
import { IDE_NAME_SHORT } from '../constants/general';
import {
  ADVANCED_ADDITIONAL_PARAMETERS_SETTING,
  ADVANCED_ADVANCED_MODE_SETTING,
  ADVANCED_AUTOSCAN_OSS_SETTING,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  OSS_ENABLED_SETTING,
  SEVERITY_FILTER_SETTING,
  TOKEN_SETTING,
  YES_BACKGROUND_OSS_NOTIFICATION_SETTING,
  YES_CRASH_REPORT_SETTING,
  YES_TELEMETRY_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from '../constants/settings';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeWorkspace } from '../vscode/workspace';

export type FeaturesConfiguration = {
  ossEnabled: boolean | undefined;
  codeSecurityEnabled: boolean | undefined;
  codeQualityEnabled: boolean | undefined;
};

export interface SeverityFilter {
  critical: boolean;
  high: boolean;
  medium: boolean;
  low: boolean;

  [severity: string]: boolean;
}

export interface IConfiguration {
  isDevelopment: boolean;
  source: string;
  baseURL: string;
  authHost: string;
  snykCodeUrl: string;
  token: string | undefined;
  snykOssApiEndpoint: string;
  snykCodeToken: string | undefined;
  setToken(token: string): Promise<void>;
  shouldReportErrors: boolean;
  shouldReportEvents: boolean;
  shouldShowWelcomeNotification: boolean;
  getFeaturesConfiguration(): FeaturesConfiguration | undefined;
  setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void>;
  shouldShowOssBackgroundScanNotification: boolean;
  shouldAutoScanOss: boolean;
  severityFilter: SeverityFilter;
  getAdditionalCliParameters(): string | undefined;
  hideWelcomeNotification(): Promise<void>;
  hideOssBackgroundScanNotification(): Promise<void>;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  private readonly defaultBaseURL = 'https://deeproxy.snyk.io';
  private readonly defaultAuthHost = 'https://snyk.io';
  private readonly defaulOssApiEndpoint = `${this.defaultAuthHost}/api/v1`;

  constructor(
    private processEnv: NodeJS.ProcessEnv = process.env,
    private workspace: IVSCodeWorkspace,
  ) {}

  static get version(): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { version } = require(path.join('../../../..', 'package.json')) as { version: string };
    return version;
  }

  get isDevelopment(): boolean {
    return !!this.processEnv.SNYK_VSCE_DEVELOPMENT;
  }

  get baseURL(): string {
    if (this.isDevelopment) {
      return this.processEnv.SNYK_VSCE_DEVELOPMENT_SNYKCODE_BASE_URL ?? 'https://deeproxy.dev.snyk.io';
    }

    return this.defaultBaseURL;
  }

  get authHost(): string {
    return this.isDevelopment ? 'https://dev.snyk.io' : this.defaultAuthHost;
  }

  get snykOssApiEndpoint(): string {
    return this.isDevelopment ? `${this.authHost}/api/v1` : this.defaulOssApiEndpoint;
  }

  get snykCodeUrl(): string {
    const authUrl = new URL(this.authHost);
    authUrl.host = `app.${authUrl.host}`;

    return `${authUrl.toString()}manage/snyk-code?from=vscode`;
  }

  get token(): string | undefined {
    return this.workspace.getConfiguration(CONFIGURATION_IDENTIFIER, this.getConfigName(TOKEN_SETTING));
  }

  get snykCodeToken(): string | undefined {
    return (this.isDevelopment && this.processEnv.SNYK_VSCE_DEVELOPMENT_SNYKCODE_TOKEN) || this.token;
  }

  async setToken(token: string | undefined): Promise<void> {
    await this.workspace.updateConfiguration(CONFIGURATION_IDENTIFIER, this.getConfigName(TOKEN_SETTING), token, true);
  }

  get source(): string {
    return this.processEnv.GITPOD_WORKSPACE_ID ? 'gitpod' : IDE_NAME_SHORT;
  }

  getFeaturesConfiguration(): FeaturesConfiguration | undefined {
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

    if (_.isUndefined(ossEnabled) && _.isUndefined(codeSecurityEnabled) && _.isUndefined(codeQualityEnabled)) {
      // TODO: return 'undefined' to render feature selection screen once OSS integration is available
      return { ossEnabled: true, codeSecurityEnabled: true, codeQualityEnabled: true };
    }

    return {
      ossEnabled,
      codeSecurityEnabled,
      codeQualityEnabled,
    };
  }

  async setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void> {
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
  }

  get shouldReportErrors(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_CRASH_REPORT_SETTING),
    );
  }

  get shouldReportEvents(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_TELEMETRY_SETTING),
    );
  }

  async setShouldReportEvents(yesTelemetry: boolean): Promise<void> {
    await this.workspace.updateConfiguration(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(YES_TELEMETRY_SETTING),
      yesTelemetry,
      true,
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

  getAdditionalCliParameters(): string | undefined {
    return this.workspace.getConfiguration<string>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ADDITIONAL_PARAMETERS_SETTING),
    );
  }

  private getConfigName = (setting: string) => setting.replace(`${CONFIGURATION_IDENTIFIER}.`, '');
}
