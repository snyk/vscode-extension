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

  remoteBundle: IFileBundle;
  changedFiles: Set<string> = new Set();

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
      case SNYK_CONTEXT.CODE_ENABLED: {
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
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.CODE_ENABLED].every(c => !!this.viewContext[c])
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
