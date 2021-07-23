import { URL } from 'url';
import * as vscode from 'vscode';
import { IDE_NAME } from './constants/general';
import {
  ADVANCED_ADVANCED_CODE_ENABLED_SETTING,
  ADVANCED_ADVANCED_MODE_SETTING,
  CONFIGURATION_IDENTIFIER,
  TOKEN_SETTING,
  YES_CRASH_REPORT_SETTING,
  YES_TELEMETRY_SETTING,
  YES_WELCOME_NOTIFICATION_SETTING,
} from './constants/settings';

export interface IConfiguration {
  isDevelopment: boolean;
  source: string;
  baseURL: string;
  authHost: string;
  snykCodeUrl: string;
  token: string | undefined;
  setToken(token: string): Promise<void>;
  codeEnabled: boolean | undefined;
  shouldReportErrors: boolean;
  shouldReportEvents: boolean;
  setCodeEnabled(value: boolean): Promise<void>;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  private staticToken = '';
  private defaultBaseURL = 'https://deeproxy.snyk.io';
  private defaultAuthHost = 'https://snyk.io';
  private staticCodeEnabled = false;

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

  async setToken(token: string): Promise<void> {
    this.staticToken = '';
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(TOKEN_SETTING), token, true);
  }

  get source(): string {
    return this.processEnv.GITPOD_WORKSPACE_ID ? 'gitpod' : IDE_NAME;
  }

  get codeEnabled(): boolean | undefined {
    return (
      this.staticCodeEnabled ||
      this.source !== IDE_NAME ||
      this.vscodeWorkspace
        .getConfiguration(CONFIGURATION_IDENTIFIER)
        .get<boolean | undefined>(this.getConfigName(ADVANCED_ADVANCED_CODE_ENABLED_SETTING))
    );
  }

  async setCodeEnabled(value = true): Promise<void> {
    await this.vscodeWorkspace
      .getConfiguration(CONFIGURATION_IDENTIFIER)
      .update(this.getConfigName(ADVANCED_ADVANCED_CODE_ENABLED_SETTING), value, true);
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
