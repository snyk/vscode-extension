import { URL } from 'url';
import * as vscode from 'vscode';
import { IDE_NAME } from './constants/general';
import {
  ADVANCED_ADVANCED_MODE_SETTING,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  CONFIGURATION_IDENTIFIER,
  TOKEN_SETTING,
  YES_CRASH_REPORT_SETTING,
  YES_TELEMETRY_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from './constants/settings';

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
  setToken(token: string): Promise<void>;
  shouldReportErrors: boolean;
  shouldReportEvents: boolean;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  private staticToken = '';
  private defaultBaseURL = 'https://deeproxy.snyk.io';
  private defaultAuthHost = 'https://snyk.io';

  constructor(
    private processEnv: NodeJS.ProcessEnv = process.env,
    private vscodeWorkspace: typeof vscode.workspace = vscode.workspace,
  ) {}

  get isDevelopment(): boolean {
    return !!process.env.SNYK_VSCE_DEVELOPMENT;
  }

  get baseURL(): string {
    return this.isDevelopment ? 'https://deeproxy.dev.snyk.io' : this.defaultBaseURL;
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
    return (
      this.staticToken ||
      this.vscodeWorkspace.getConfiguration(CONFIGURATION_IDENTIFIER).get(this.getConfigName(TOKEN_SETTING))
    );
  }

  async setToken(token: string | undefined): Promise<void> {
    this.staticToken = '';
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(TOKEN_SETTING), token, true);
  }

  get source(): string {
    return this.processEnv.GITPOD_WORKSPACE_ID ? 'gitpod' : IDE_NAME;
  }

  getFeaturesConfiguration(): FeaturesConfiguration | undefined {
    const codeSecurityEnabled = this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(CODE_SECURITY_ENABLED_SETTING));
    const codeQualityEnabled = this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(CODE_QUALITY_ENABLED_SETTING));

    if (!codeSecurityEnabled && !codeQualityEnabled) {
      return undefined;
    }

    return {
      codeSecurityEnabled,
      codeQualityEnabled,
    };
  }

  async setFeaturesConfiguration(config: FeaturesConfiguration | undefined): Promise<void> {
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(CODE_SECURITY_ENABLED_SETTING), config?.codeSecurityEnabled, true);
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(CODE_QUALITY_ENABLED_SETTING), config?.codeQualityEnabled, true);
  }

  get shouldReportErrors(): boolean {
    return !!this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(YES_CRASH_REPORT_SETTING));
  }

  get shouldReportEvents(): boolean {
    return !!this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(YES_TELEMETRY_SETTING));
  }

  async setShouldReportEvents(yesTelemetry: boolean): Promise<void> {
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(YES_TELEMETRY_SETTING), yesTelemetry, true);
  }

  get shouldShowWelcomeNotification(): boolean {
    return !!this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(YES_WELCOME_NOTIFICATION_SETTING));
  }

  async hideWelcomeNotification(): Promise<void> {
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(YES_WELCOME_NOTIFICATION_SETTING), false, true);
  }

  get shouldShowAdvancedView(): boolean {
    return !!this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .get<boolean>(this.getConfigName(ADVANCED_ADVANCED_MODE_SETTING));
  }

  private getConfigName = (setting: string) => setting.replace(`${CONFIGURATION_IDENTIFIER}.`, '');
}

export const configuration = new Configuration();
