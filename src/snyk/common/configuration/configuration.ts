import { URL } from 'url';
import { IDE_NAME } from '../constants/general';
import {
  ADVANCED_ADVANCED_MODE_SETTING,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  TOKEN_SETTING,
  YES_CRASH_REPORT_SETTING,
  YES_TELEMETRY_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from '../constants/settings';
import { IVSCodeWorkspace } from '../vscode/workspace';

export type FeaturesConfiguration = {
  codeSecurityEnabled: boolean | undefined;
  codeQualityEnabled: boolean | undefined;
};

export interface IConfiguration {
  isDevelopment: boolean;
  source: string;
  baseURL: string;
  authHost: string;
  snykCodeUrl: string;
  token: string | undefined;
  snykCodeToken: string | undefined;
  setToken(token: string): Promise<void>;
  shouldReportErrors: boolean;
  shouldReportEvents: boolean;
  getFeaturesConfiguration(): FeaturesConfiguration | undefined;
  setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void>;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  private defaultBaseURL = 'https://deeproxy.snyk.io';
  private defaultAuthHost = 'https://snyk.io';

  constructor(private processEnv: NodeJS.ProcessEnv = process.env, private workspace: IVSCodeWorkspace) {}

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
    return this.processEnv.GITPOD_WORKSPACE_ID ? 'gitpod' : IDE_NAME;
  }

  getFeaturesConfiguration(): FeaturesConfiguration | undefined {
    const codeSecurityEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(CODE_SECURITY_ENABLED_SETTING),
    );
    const codeQualityEnabled = this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(CODE_QUALITY_ENABLED_SETTING),
    );

    if (!codeSecurityEnabled && !codeQualityEnabled) {
      // TODO: return 'undefined' to render feature selection screen once OSS integration is available
      return { codeSecurityEnabled: true, codeQualityEnabled: true };
    }

    return {
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

  get shouldShowAdvancedView(): boolean {
    return !!this.workspace.getConfiguration<boolean>(
      CONFIGURATION_IDENTIFIER,
      this.getConfigName(ADVANCED_ADVANCED_MODE_SETTING),
    );
  }

  private getConfigName = (setting: string) => setting.replace(`${CONFIGURATION_IDENTIFIER}.`, '');
}
