import { IConfiguration } from '../common/configuration/configuration';
import { getSastSettings } from '../common/services/cliConfigService';
import { IOpenerService } from '../common/services/openerService';
import * as vscode from 'vscode';
import { Logger } from '../common/logger/logger';
import { SupportedAnalysisProperties } from '../common/analytics/itly';
import { analyzeFolders, constants, extendAnalysis, IFileBundle } from '@snyk/code-client';
import SnykCodeAnalyzer from './analyzer/analyzer';
import { IViewManagerService } from '../common/services/viewManagerService';
import { SuggestionProvider } from './views/suggestionProvider';
import { errorsLogs } from '../common/messages/errorsServerLogMessages';
import { Progress } from './analyzer/progress';
import { analytics } from '../common/analytics/analytics';
import { errorType } from '../base/modules/interfaces';
import { ISnykCodeAnalyzer } from './interfaces';
import { ISuggestionProvider } from './views/interfaces';
import { IDE_NAME } from '../common/constants/general';

export interface ISnykCode {
  analyzer: ISnykCodeAnalyzer;
  isAnalysisRunning: boolean;
  lastAnalysisDuration: number;
  lastAnalysisTimestamp: number;
  analysisStatus: string;
  analysisProgress: string;
  changedFiles: Set<string>;
  remoteBundle: IFileBundle;
  suggestionProvider: ISuggestionProvider;
  onError: (error: errorType, options: { [key: string]: any }) => Promise<void>;

  startAnalysis(paths: string[], manual: boolean): Promise<void>;
  stopAnalysis(): void;
  finaliseAnalysis(): void;
  updateStatus(status: string, progress: string): void;
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
  dispose(): void;
}

export class SnykCode implements ISnykCode {
  runningAnalysis = false;
  changedFiles: Set<string> = new Set();
  remoteBundle: IFileBundle;
  analyzer: ISnykCodeAnalyzer;
  suggestionProvider: ISuggestionProvider;

  private progress: Progress;
  private lastAnalysisStartingTimestamp = Date.now();
  private _lastAnalysisDuration = 0;
  private _lastAnalysisTimestamp = Date.now();
  private _analysisStatus = '';
  private _analysisProgress = '';

  constructor(
    private readonly config: IConfiguration,
    private readonly openerService: IOpenerService,
    private readonly viewManagerService: IViewManagerService,
    filesWatcher: vscode.FileSystemWatcher,
    private onErrorFn: (error: errorType, options: { [key: string]: any }) => Promise<void>,
  ) {
    this.analyzer = new SnykCodeAnalyzer();
    this.suggestionProvider = new SuggestionProvider();

    this.progress = new Progress(this, filesWatcher, viewManagerService);
    this.progress.bindListeners();
  }

  get onError(): (error: errorType, options: { [key: string]: any }) => Promise<void> {
    return this.onErrorFn;
  }

  get isAnalysisRunning(): boolean {
    return this.runningAnalysis;
  }
  get lastAnalysisDuration(): number {
    return this._lastAnalysisDuration;
  }
  get lastAnalysisTimestamp(): number {
    return this._lastAnalysisTimestamp;
  }
  get analysisStatus(): string {
    return this._analysisStatus;
  }
  get analysisProgress(): string {
    return this._analysisProgress;
  }

  public async startAnalysis(paths: string[], manual: boolean): Promise<void> {
    if (this.isAnalysisRunning || !paths.length) {
      return;
    }

    const enabledFeatures = this.config.getFeaturesConfiguration();

    try {
      Logger.info('Code analysis started.');

      const analysisType: SupportedAnalysisProperties[] = [];
      if (enabledFeatures?.codeSecurityEnabled) analysisType.push('Snyk Code Security');
      if (enabledFeatures?.codeQualityEnabled) analysisType.push('Snyk Code Quality');

      analytics.logAnalysisIsTriggered({
        analysisType,
        ide: IDE_NAME,
        triggeredByUser: manual,
      });

      this.runAnalysis();

      let result;
      if (this.changedFiles.size && this.remoteBundle) {
        const changedFiles = [...this.changedFiles];
        this.changedFiles.clear();
        result = await extendAnalysis(this.remoteBundle, changedFiles, constants.MAX_PAYLOAD, this.config.source);
      } else {
        result = await analyzeFolders({
          baseURL: this.config.baseURL,
          sessionToken: this.config.snykCodeToken ?? '', // todo: handle the case appropriately
          paths,
          source: this.config.source,
        });
      }

      if (result) {
        this.remoteBundle = result;

        this.analyzer.analysisResults = result.analysisResults;
        this.analyzer.createReviewResults();

        Logger.info('Code analysis finished.');

        if (enabledFeatures?.codeSecurityEnabled) {
          analytics.logAnalysisIsReady({
            ide: IDE_NAME,
            analysisType: 'Snyk Code Security',
            result: 'Success',
          });
        }
        if (enabledFeatures?.codeQualityEnabled) {
          analytics.logAnalysisIsReady({
            ide: IDE_NAME,
            analysisType: 'Snyk Code Quality',
            result: 'Success',
          });
        }

        this.viewManagerService.refreshFeatureAnalysisViews(enabledFeatures);
        this.suggestionProvider.checkCurrentSuggestion();
      }
    } catch (err) {
      this.stopAnalysis();
      void this.onErrorFn(err, {
        message: errorsLogs.failedServiceAI,
      });
      if (enabledFeatures?.codeSecurityEnabled) {
        analytics.logAnalysisIsReady({
          ide: IDE_NAME,
          analysisType: 'Snyk Code Security',
          result: 'Error',
        });
      }
      if (enabledFeatures?.codeQualityEnabled) {
        analytics.logAnalysisIsReady({
          ide: IDE_NAME,
          analysisType: 'Snyk Code Quality',
          result: 'Error',
        });
      }

      Logger.info('Code analysis failed.');
    } finally {
      this.finaliseAnalysis();
    }
  }

  runAnalysis(): void {
    this.runningAnalysis = true;
    this.lastAnalysisStartingTimestamp = Date.now();
  }

  stopAnalysis(): void {
    this.runningAnalysis = false;
  }

  finaliseAnalysis(): void {
    this.runningAnalysis = false;
    this._lastAnalysisTimestamp = Date.now();
    this._lastAnalysisDuration = this._lastAnalysisTimestamp - this.lastAnalysisStartingTimestamp;
  }

  updateStatus(status: string, progress: string): void {
    this._analysisStatus = status;
    this._analysisProgress = progress;
  }

  async isEnabled(): Promise<boolean> {
    const settings = await getSastSettings();
    return settings.sastEnabled;
  }

  async enable(): Promise<boolean> {
    let settings = await getSastSettings();
    if (settings.sastEnabled) {
      return true;
    }

    if (this.config.snykCodeUrl != null) {
      await this.openerService.openBrowserUrl(this.config.snykCodeUrl);
    }

    // Poll for changed settings (65 sec)
    for (let i = 2; i < 12; i += 1) {
      await this.sleep(i * 1000);

      settings = await getSastSettings();
      if (settings.sastEnabled) {
        return true;
      }
    }

    return false;
  }

  dispose(): void {
    this.progress.removeAllListeners();
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
