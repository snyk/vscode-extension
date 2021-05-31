import { URL } from 'url';
import * as vscode from 'vscode';
import { IDE_NAME } from './constants/general';

export interface IConfiguration {
  source: string;
  staticToken: string;
  defaultBaseURL: string;
  baseURL: string;
  authHost: string;
  termsConditionsUrl: string;
  snykCodeUrl: string;
  token: string;
  setToken(token: string): Promise<void>;
  uploadApproved: boolean;
  codeEnabled: boolean | undefined;
  shouldReportErrors: boolean;
  shouldReportEvents: boolean;
  setCodeEnabled(value: boolean): Promise<void>;
}

export class Configuration implements IConfiguration {
  // These attributes are used in tests
  staticToken = '';
  defaultBaseURL = 'https://deeproxy.snyk.io';
  defaultAuthHost = 'https://snyk.io';
  staticCodeEnabled = false;

  get baseURL(): string {
    // @ts-ignore */}
    return vscode.workspace.getConfiguration('snyk').get('url') || this.defaultBaseURL;
  }

  get authHost(): string {
    // @ts-ignore */}
    return vscode.workspace.getConfiguration('snyk').get('authHost') || this.defaultAuthHost;
  }

  get termsConditionsUrl(): string {
    return `${this.authHost}/policies/terms-of-service/?utm_source=${this.source}`; // todo: unused?
  }

  get snykCodeUrl(): string {
    const authUrl = new URL(this.authHost);
    authUrl.host = `app.${authUrl.host}`;

    return `${authUrl.toString()}manage/snyk-code`;
  }

  get token(): string {
    // @ts-ignore */}
    return this.staticToken || vscode.workspace.getConfiguration('snyk').get('token');
  }

  async setToken(token: string): Promise<void> {
    this.staticToken = '';
    await vscode.workspace.getConfiguration('snyk').update('token', token, true);
  }

  get source(): string {
    return process.env.GITPOD_WORKSPACE_ID ? 'gitpod' : IDE_NAME;
  }

  get uploadApproved(): boolean {
    return (
      this.staticCodeEnabled ||
      this.source !== IDE_NAME ||
      !!vscode.workspace.getConfiguration('snyk').get<boolean>('uploadApproved') // TODO: remove once grace period is out
    );
  }

  get codeEnabled(): boolean | undefined {
    return (
      this.staticCodeEnabled ||
      this.source !== IDE_NAME ||
      vscode.workspace.getConfiguration('snyk').get<boolean | undefined>('codeEnabled') // TODO: check if matches the backend's setting result
    );
  }

  async setCodeEnabled(value = true): Promise<void> {
    await vscode.workspace.getConfiguration('snyk').update('codeEnabled', value, true);
  }

  get shouldReportErrors(): boolean {
    return !!vscode.workspace.getConfiguration('snyk').get<boolean>('yesCrashReport');
  }

  get shouldReportEvents(): boolean {
    return !!vscode.workspace.getConfiguration('snyk').get<boolean>('yesTelemetry');
  }

  get shouldShowWelcomeNotification(): boolean {
    return !!vscode.workspace.getConfiguration('snyk').get<boolean>('yesWelcomeNotification');
  }

  async hideWelcomeNotification(): Promise<void> {
    await vscode.workspace.getConfiguration('snyk').update('yesWelcomeNotification', false, true);
  }

  get shouldShowAdvancedView(): boolean {
    return !!vscode.workspace.getConfiguration('snyk').get<boolean>('advancedMode');
  }
}

export const configuration = new Configuration();
