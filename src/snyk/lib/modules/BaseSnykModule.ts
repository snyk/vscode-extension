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
import { Logger } from '../../logger';
import { ContextService, IContextService } from '../../services/contextService';
import { IOpenerService, OpenerService } from '../../services/openerService';
import { IViewManagerService, ViewManagerService } from '../../services/viewManagerService';
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
  viewManagerService: IViewManagerService;

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
    this.viewManagerService = new ViewManagerService();
    this.contextService = new ContextService();
    this.openerService = new OpenerService();
    this.snykCode = new SnykCode(configuration, this.openerService);
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
