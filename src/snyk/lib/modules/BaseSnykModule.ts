import { IFileBundle } from '@snyk/code-client';
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
import { SNYK_CONTEXT } from '../../constants/views';
import { Logger } from '../../logger';
import { ContextService, IContextService } from '../../services/contextService';
import { IOpenerService, OpenerService } from '../../services/openerService';
import { PendingTask, PendingTaskInterface } from '../../utils/pendingTask';
import { SuggestionProvider } from '../../view/SuggestionProvider';
import SnykAnalyzer from '../analyzer/SnykAnalyzer';
import SnykStatusBarItem from '../statusBarItem/SnykStatusBarItem';
import SnykEditorsWatcher from '../watchers/EditorsWatcher';
import SnykSettingsWatcher from '../watchers/SnykSettingsWatcher';
import { ISnykCode, SnykCode } from './code';

export default abstract class BaseSnykModule implements BaseSnykModuleInterface {
  analyzer: AnalyzerInterface;
  statusBarItem: StatusBarItemInterface;
  filesWatcher: vscode.FileSystemWatcher;
  editorsWatcher: SnykWatcherInterface;
  settingsWatcher: SnykWatcherInterface;
  suggestionProvider: SuggestionProviderInterface;
  contextService: IContextService;
  openerService: IOpenerService;

  // Views and analysis progress
  analysisStatus = '';
  analysisProgress = '';
  protected initializedView: PendingTaskInterface;
  analytics: Iteratively;

  remoteBundle: IFileBundle;
  changedFiles: Set<string> = new Set();

  protected snykCode: ISnykCode;

  constructor() {
    this.analyzer = new SnykAnalyzer();
    this.statusBarItem = new SnykStatusBarItem();
    this.editorsWatcher = new SnykEditorsWatcher();
    this.settingsWatcher = new SnykSettingsWatcher();
    this.suggestionProvider = new SuggestionProvider();
    this.analysisStatus = '';
    this.analysisProgress = '';
    this.initializedView = new PendingTask();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.snykCode = new SnykCode(configuration, this.openerService);
  }

  get shouldShowAnalysis(): boolean {
    return (
      !this.contextService.viewContext[SNYK_CONTEXT.ERROR] &&
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.CODE_ENABLED].every(c => !!this.contextService.viewContext[c])
    );
  }

  emitViewInitialized(): void {
    if (!this.initializedView.isCompleted) this.initializedView.complete();
  }

  loadAnalytics(): void {
    if (!this.analytics) {
      this.analytics = new Iteratively(Logger, configuration.shouldReportEvents, configuration.isDevelopment);
      this.analytics.load();
    }
  }
  abstract processError(error: errorType, options?: { [key: string]: any }): Promise<void>;

  abstract startExtension(): Promise<void>;
}
