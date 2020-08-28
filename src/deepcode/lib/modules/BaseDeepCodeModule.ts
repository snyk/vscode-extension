import * as vscode from 'vscode';
import * as _ from "lodash";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import DeepCodeAnalyzer from "../analyzer/DeepCodeAnalyzer";
import DeepCodeStatusBarItem from "../statusBarItem/DeepCodeStatusBarItem";
import DeepCodeFilesWatcher from "../watchers/DeepCodeFilesWatcher";
import DeepCodeWorkspaceFoldersWatcher from "../watchers/WorkspaceFoldersWatcher";
import DeepCodeEditorsWatcher from "../watchers/EditorsWatcher";
import DeepCodeSettingsWatcher from "../watchers/DeepCodeSettingsWatcher";
import { PendingTask, PendingTaskInterface } from "../../utils/pendingTask";
import { IDE_NAME, REFRESH_VIEW_DEBOUNCE_INTERVAL } from "../../constants/general";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT, DEEPCODE_VIEW_ANALYSIS } from "../../constants/views";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";
import { errorsLogs } from '../../messages/errorsServerLogMessages';

export default abstract class BaseDeepCodeModule implements DeepCode.BaseDeepCodeModuleInterface {
  currentWorkspacePath: string;
  workspacesPaths: Array<string>;
  hashesBundles: DeepCode.HashesBundlesInterface;
  serverFilesFilterList: DeepCode.AllowedServerFilterListInterface;
  remoteBundles: DeepCode.RemoteBundlesCollectionInterface;
  analyzer: DeepCode.AnalyzerInterface;
  statusBarItem: DeepCode.StatusBarItemInterface;
  filesWatcher: DeepCode.DeepCodeWatcherInterface;
  workspacesWatcher: DeepCode.DeepCodeWatcherInterface;
  editorsWatcher: DeepCode.DeepCodeWatcherInterface;
  settingsWatcher: DeepCode.DeepCodeWatcherInterface;

  // Views and analysis progress
  refreshViewEmitter: vscode.EventEmitter<any>;
	analysisStatus = '';
  analysisProgress = 0;
  private initializedView: PendingTaskInterface;
  private progressBadge: PendingTaskInterface | undefined;
  private shouldShowProgressBadge = false;
  private viewContext: {[key: string]: unknown};

  // These attributes are used in tests
  staticToken = '';
  staticBaseURL = '';
  defaultBaseURL = 'https://www.deepcode.ai';
  staticUploadApproved = false;

  constructor() {
    this.currentWorkspacePath = "";
    this.workspacesPaths = [];
    this.hashesBundles = {};
    this.serverFilesFilterList = {};
    this.remoteBundles = {};
    this.analyzer = new DeepCodeAnalyzer();
    this.statusBarItem = new DeepCodeStatusBarItem();
    this.filesWatcher = new DeepCodeFilesWatcher();
    this.workspacesWatcher = new DeepCodeWorkspaceFoldersWatcher();
    this.editorsWatcher = new DeepCodeEditorsWatcher();
    this.settingsWatcher = new DeepCodeSettingsWatcher();
    this.refreshViewEmitter = new vscode.EventEmitter<any>();
    this.analysisStatus = '';
    this.analysisProgress = 0;
    this.viewContext = {};
    this.initializedView = new PendingTask();
  }

  get baseURL(): string {
    // @ts-ignore */}
    return this.staticBaseURL || vscode.workspace.getConfiguration('deepcode').get('url') || this.defaultBaseURL;
  }

  get termsConditionsUrl(): string {
    return `${this.baseURL}/tc?utm_source=vsc`;
  }

  get token(): string {
    // @ts-ignore */}
    return this.staticToken || vscode.workspace.getConfiguration('deepcode').get('token');
  }

  async setToken(token: string): Promise<void>  {
    this.staticToken = '';
    await vscode.workspace.getConfiguration('deepcode').update('token', token, true);
  }

  get source(): string {
    return process.env['GITPOD_WORKSPACE_ID'] ? 'gitpod' : IDE_NAME;
  }

  get uploadApproved(): boolean {
    return this.staticUploadApproved || this.source !== IDE_NAME || !!(vscode.workspace.getConfiguration('deepcode').get<boolean>('uploadApproved'));
  }

  async setUploadApproved(value = true): Promise<void> {
    await vscode.workspace.getConfiguration('deepcode').update('uploadApproved', value, true);
  }

  get shouldReportErrors(): boolean {
    return !!vscode.workspace.getConfiguration('deepcode').get<boolean>('yesCrashReport');
  }

  get shouldReportEvents(): boolean {
    return !!vscode.workspace.getConfiguration('deepcode').get<boolean>('yesTelemetry');
  }

  get shouldShowWelcomeNotification(): boolean {
    return !!vscode.workspace.getConfiguration('deepcode').get<boolean>('yesWelcomeNotification');
  }

  async hideWelcomeNotification(): Promise<void> {
    await vscode.workspace.getConfiguration('deepcode').update('yesWelcomeNotification', false, true);
  }

  get shouldShowAdvancedView(): boolean {
    return !!vscode.workspace.getConfiguration('deepcode').get<boolean>('advancedMode');
  }

  async setContext(key: string, value: unknown): Promise<void> {
    console.log("DeepCode context", key, value);
    const oldValue = this.viewContext[key];
    this.viewContext[key] = value;
    await setContext(key, value);
    this.refreshViews();
    this.trackContextChange(key, value, oldValue);
  }

  private trackContextChange(key: string, value: unknown, oldValue: unknown) {
    let event = "";
    let shouldWaitForView = true;
    let options: Record<string,any> | undefined;
    switch(key) {
      case DEEPCODE_CONTEXT.LOGGEDIN: {
        if (oldValue !== undefined) {
          if (!value && oldValue) event = TELEMETRY_EVENTS.viewLoginView;
          if (value && !oldValue) event = TELEMETRY_EVENTS.viewConsentView;
        } else {
          // If key was un-initialized (i.e. at start), we still report it if new value is false
          if (!value) event = TELEMETRY_EVENTS.viewLoginView;
        }
        break;
      }
      case DEEPCODE_CONTEXT.APPROVED: {
        if (oldValue !== undefined) {
          if (!value && oldValue) event = TELEMETRY_EVENTS.viewConsentView;
          if (value && !oldValue) event = TELEMETRY_EVENTS.viewSuggestionView;
        }
        break;
      }
      case DEEPCODE_CONTEXT.ADVANCED: {
        if (oldValue !== undefined) {
          event = TELEMETRY_EVENTS.toggleAdvancedMode;
          options = { data: { value } };
          shouldWaitForView = false;
        }
        break;
      }
      case DEEPCODE_CONTEXT.MODE: {
        event = TELEMETRY_EVENTS.changeExecutionMode;
        options = { data: { value } };
        shouldWaitForView = false;
        break;
      }
    }
    // We want to fire the event only when the user actually sees the View
    if (event) {
      if (shouldWaitForView) this.initializedView.waiter.then(
        () => this.processEvent(event, options)
      );
      else this.processEvent(event, options);
    }
  }

  get shouldShowAnalysis(): boolean {
    return !this.viewContext[
      DEEPCODE_CONTEXT.ERROR
    ] && [
      DEEPCODE_CONTEXT.LOGGEDIN,
      DEEPCODE_CONTEXT.APPROVED,
      DEEPCODE_CONTEXT.ANALYZING,
    ].every(
      (c) => !!this.viewContext[c]
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
      this.initializedView.waiter.then(
        () => vscode.window.withProgress(
          { location: { viewId: DEEPCODE_VIEW_ANALYSIS } },
          () => self.getProgressBadgePromise()
        )
      ).then(
        () => {},
        (error) => self.processError(error, {
          message: errorsLogs.loadingBadge,
        })
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
  refreshViews = _.debounce(
    (content?: any): void => this.refreshViewEmitter.fire(content || undefined),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    { 'leading': true }
  );

  abstract processError(
    error: DeepCode.errorType,
    options?: { [key: string]: any }
  ): Promise<void>;

  abstract processEvent(
    event: string,
    options?: { [key: string]: any }
  ): Promise<void>;

  abstract startExtension(): Promise<void>;
}
