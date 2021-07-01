import { IFileBundle } from '@snyk/code-client';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import {
  AnalyzerInterface,
  BaseSnykModuleInterface,
  errorType,
  SnykWatcherInterface,
  StatusBarItemInterface,
  SuggestionProviderInterface,
} from '../../../interfaces/SnykInterfaces';
import { Iteratively } from '../../analytics/itly';
import { configuration } from '../../configuration';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../../constants/general';
import { SNYK_CONTEXT } from '../../constants/views';
import { Logger } from '../../logger';
import { PendingTask, PendingTaskInterface } from '../../utils/pendingTask';
import { setContext } from '../../utils/vscodeCommandsUtils';
import { SuggestionProvider } from '../../view/SuggestionProvider';
import SnykAnalyzer from '../analyzer/SnykAnalyzer';
import SnykStatusBarItem from '../statusBarItem/SnykStatusBarItem';
import SnykEditorsWatcher from '../watchers/EditorsWatcher';
import SnykSettingsWatcher from '../watchers/SnykSettingsWatcher';

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
  protected initializedView: PendingTaskInterface;
  private viewContext: { [key: string]: unknown };
  analytics: Iteratively;

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
  }

  get shouldShowAnalysis(): boolean {
    return (
      !this.viewContext[SNYK_CONTEXT.ERROR] &&
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.CODE_ENABLED].every(c => !!this.viewContext[c])
    );
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

  loadAnalytics(): void {
    if (!this.analytics) {
      this.analytics = new Iteratively(Logger, configuration.shouldReportEvents, configuration.isDevelopment);
      this.analytics.load();
    }
  }
  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract startExtension(): Promise<void>;
}
