import * as vscode from 'vscode';
import * as _ from "lodash";
import {
  BaseSnykModuleInterface,
  AnalyzerInterface,
  StatusBarItemInterface,
  SnykWatcherInterface,
  SuggestionProviderInterface,
  errorType,
} from "../../../interfaces/SnykInterfaces";
import SnykAnalyzer from "../analyzer/SnykAnalyzer";
import SnykStatusBarItem from '../statusBarItem/SnykStatusBarItem';
import SnykEditorsWatcher from "../watchers/EditorsWatcher";
import SnykSettingsWatcher from "../watchers/SnykSettingsWatcher";
import { SuggestionProvider } from "../../view/SuggestionProvider";
import { PendingTask, PendingTaskInterface } from "../../utils/pendingTask";
import { IDE_NAME, REFRESH_VIEW_DEBOUNCE_INTERVAL } from "../../constants/general";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { SNYK_CONTEXT, SNYK_VIEW_ANALYSIS } from "../../constants/views";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";
import { errorsLogs } from '../../messages/errorsServerLogMessages';

import { IFileBundle } from '@snyk/code-client';
import { ApiClient } from "../../api/api-client";
import { Segment } from "../../analytics/segment";

export default abstract class BaseSnykModule implements BaseSnykModuleInterface {
  analyzer: AnalyzerInterface;
  statusBarItem: StatusBarItemInterface;
  filesWatcher: vscode.FileSystemWatcher;
  editorsWatcher: SnykWatcherInterface;
  settingsWatcher: SnykWatcherInterface;
  suggestionProvider: SuggestionProviderInterface;

  // Views and analysis progress
  refreshViewEmitter: vscode.EventEmitter<any>;
  analysisStatus = '';
  analysisProgress = '';
  private initializedView: PendingTaskInterface;
  private progressBadge: PendingTaskInterface | undefined;
  private shouldShowProgressBadge = false;
  private viewContext: { [key: string]: unknown };
  analytics: Segment;
  userId: string;
  apiClient: ApiClient;

  remoteBundle: IFileBundle;
  changedFiles: Set<string> = new Set();

  // These attributes are used in tests
  staticToken = '';
  defaultBaseURL = 'https://deeproxy.snyk.io';
  defaultAuthHost = 'https://snyk.io';
  staticUploadApproved = false;

  constructor() {
    this.analyzer = new SnykAnalyzer();
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.settingsWatcher = new SnykSettingsWatcher();
    this.refreshViewEmitter = new vscode.EventEmitter<any>();
    this.suggestionProvider = new SuggestionProvider();
    this.analysisStatus = '';
    this.analysisProgress = '';
    this.viewContext = {};
    this.initializedView = new PendingTask();
  }

  get baseURL(): string {
    // @ts-ignore */}
    return vscode.workspace.getConfiguration('snyk').get('url') || this.defaultBaseURL;
  }

  get authHost(): string {
    // @ts-ignore */}
    return vscode.workspace.getConfiguration('snyk').get('authHost') || this.defaultAuthHost;
  }

  get termsConditionsUrl(): string {
    return `${this.authHost}/policies/terms-of-service/?utm_source=${this.source}`;
  }

  get token(): string {
    // @ts-ignore */}
    return this.staticToken || vscode.workspace.getConfiguration('snyk').get('token');
  }

  async setToken(token: string): Promise<void> {
    this.staticToken = '';
    await vscode.workspace.getConfiguration('snyk').update('token', token, true);
  }

  createApiClient(): void {
    const baseURL: string = vscode.workspace.getConfiguration('snyk').get('authHost') || this.defaultAuthHost + '/api';
    this.apiClient =  new ApiClient(baseURL, this.token);
  };

  createAnalytics(): void {
    if (!this.analytics) {
      this.analytics = new Segment();
    }
  }

  get source(): string {
    return process.env['GITPOD_WORKSPACE_ID'] ? 'gitpod' : IDE_NAME;
  }

  get uploadApproved(): boolean {
    return (
      this.staticUploadApproved ||
      this.source !== IDE_NAME ||
      !!vscode.workspace.getConfiguration('snyk').get<boolean>('uploadApproved')
    );
  }

  async setUploadApproved(value = true): Promise<void> {
    await vscode.workspace.getConfiguration('snyk').update('uploadApproved', value, true);
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

  async setContext(key: string, value: unknown): Promise<void> {
    console.log('Snyk context', key, value);
    const oldValue = this.viewContext[key];
    this.viewContext[key] = value;
    await setContext(key, value);
    this.refreshViews();
    this.trackContextChange(key, value, oldValue);
  }

  private trackContextChange(key: string, value: unknown, oldValue: unknown) {
    let event = '';
    let shouldWaitForView = true;
    let options: Record<string, any> | undefined;
    switch (key) {
      case SNYK_CONTEXT.LOGGEDIN: {
        if (oldValue !== undefined) {
          if (!value && oldValue) event = TELEMETRY_EVENTS.viewLoginView;
          if (value && !oldValue) event = TELEMETRY_EVENTS.viewConsentView;
        } else {
          // If key was un-initialized (i.e. at start), we still report it if new value is false
          if (!value) event = TELEMETRY_EVENTS.viewLoginView;
        }
        break;
      }
      case SNYK_CONTEXT.APPROVED: {
        if (oldValue !== undefined) {
          if (!value && oldValue) event = TELEMETRY_EVENTS.viewConsentView;
          if (value && !oldValue) event = TELEMETRY_EVENTS.viewSuggestionView;
        }
        break;
      }
      case SNYK_CONTEXT.ADVANCED: {
        if (oldValue !== undefined) {
          event = TELEMETRY_EVENTS.toggleAdvancedMode;
          options = { data: { value } };
          shouldWaitForView = false;
        }
        break;
      }
      case SNYK_CONTEXT.MODE: {
        event = TELEMETRY_EVENTS.changeExecutionMode;
        options = { data: { value } };
        shouldWaitForView = false;
        break;
      }
    }
    // We want to fire the event only when the user actually sees the View
    if (event) {
      if (shouldWaitForView) this.initializedView.waiter.then(() => this.processEvent(event, options));
      else this.processEvent(event, options);
    }
  }

  get shouldShowAnalysis(): boolean {
    return (
      !this.viewContext[SNYK_CONTEXT.ERROR] &&
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.APPROVED].every(c => !!this.viewContext[c])
    );
  }

  private getProgressBadgePromise(): Promise<void> {
    if (!this.shouldShowProgressBadge) return Promise.resolve();
    if (!this.progressBadge || this.progressBadge.isCompleted) {
      this.progressBadge = new PendingTask();
    }
    return this.progressBadge.waiter;
  }

  // Leave viewId undefined to remove the badge from all views
  async setLoadingBadge(value: boolean): Promise<void> {
    this.shouldShowProgressBadge = value;
    if (value) {
      // Using closure on this to allow partial binding in arbitrary positions
      const self = this;
      this.initializedView.waiter
        .then(() =>
          vscode.window.withProgress({ location: { viewId: SNYK_VIEW_ANALYSIS } }, () =>
            self.getProgressBadgePromise(),
          ),
        )
        .then(
          () => {},
          error =>
            self.processError(error, {
              message: errorsLogs.loadingBadge,
            }),
        );
    } else {
      if (this.progressBadge && !this.progressBadge.isCompleted) {
        this.progressBadge.complete();
      }
    }
  }

  emitViewInitialized(): void {
    if (!this.initializedView.isCompleted) this.initializedView.complete();
  }

  // Avoid refreshing context/views too often:
  // https://github.com/Microsoft/vscode/issues/68424
  refreshViews = _.throttle(
    (content?: any): void => this.refreshViewEmitter.fire(content || undefined),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    { leading: true },
  );

  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract processEvent(event: string, options?: { [key: string]: any }): Promise<void>;

  abstract startExtension(): Promise<void>;
}
