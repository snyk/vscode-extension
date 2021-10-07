import { analyzeFolders, extendAnalysis, FileAnalysis } from '@snyk/code-client';
import { errorType } from '../base/modules/interfaces';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { analytics } from '../common/analytics/analytics';
import { SupportedAnalysisProperties } from '../common/analytics/itly';
import { IConfiguration } from '../common/configuration/configuration';
import { IDE_NAME } from '../common/constants/general';
import { Logger } from '../common/logger/logger';
import { errorsLogs } from '../common/messages/errorsServerLogMessages';
import { getSastSettings } from '../common/services/cliConfigService';
import { IOpenerService } from '../common/services/openerService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import SnykCodeAnalyzer from './analyzer/analyzer';
import { Progress } from './analyzer/progress';
import { ISnykCodeAnalyzer } from './interfaces';
import { ICodeSuggestionWebviewProvider } from './views/interfaces';
import { CodeSuggestionWebviewProvider } from './views/suggestion/codeSuggestionWebviewProvider';

export interface ISnykCodeService extends AnalysisStatusProvider {
  analyzer: ISnykCodeAnalyzer;
  analysisStatus: string;
  analysisProgress: string;
  remoteBundle: FileAnalysis;
  suggestionProvider: ICodeSuggestionWebviewProvider;
  onError: (error: errorType, options: { [key: string]: any }) => Promise<void>;

  startAnalysis(paths: string[], manual: boolean, reportTriggeredEvent: boolean): Promise<void>;
  updateStatus(status: string, progress: string): void;
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
  addChangedFile(filePath: string): void;
  dispose(): void;
}

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  remoteBundle: FileAnalysis;
  analyzer: ISnykCodeAnalyzer;
  suggestionProvider: ICodeSuggestionWebviewProvider;

  private changedFiles: Set<string> = new Set();

  private progress: Progress;
  private _analysisStatus = '';
  private _analysisProgress = '';

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly openerService: IOpenerService,
    private readonly viewManagerService: IViewManagerService,
    private readonly workspace: IVSCodeWorkspace,
    private onErrorFn: (error: errorType, options: { [key: string]: any }) => Promise<void>,
  ) {
    super();
    this.analyzer = new SnykCodeAnalyzer();
    this.suggestionProvider = new CodeSuggestionWebviewProvider(extensionContext);

    this.progress = new Progress(this, viewManagerService, this.workspace);
    this.progress.bindListeners();
  }

  get onError(): (error: errorType, options: { [key: string]: any }) => Promise<void> {
    return this.onErrorFn;
  }

  get analysisStatus(): string {
    return this._analysisStatus;
  }
  get analysisProgress(): string {
    return this._analysisProgress;
  }

  public async startAnalysis(paths: string[], manualTrigger: boolean, reportTriggeredEvent: boolean): Promise<void> {
    if (this.isAnalysisRunning || !paths.length) {
      return;
    }

    const enabledFeatures = this.config.getFeaturesConfiguration();

    try {
      Logger.info('Code analysis started.');

      if (reportTriggeredEvent) {
        const analysisType: SupportedAnalysisProperties[] = [];
        if (enabledFeatures?.codeSecurityEnabled) analysisType.push('Snyk Code Security');
        if (enabledFeatures?.codeQualityEnabled) analysisType.push('Snyk Code Quality');

        analytics.logAnalysisIsTriggered({
          analysisType,
          ide: IDE_NAME,
          triggeredByUser: manualTrigger,
        });
      }

      this.analysisStarted();

      let result: FileAnalysis | null = null;
      if (this.changedFiles.size && this.remoteBundle) {
        const changedFiles = [...this.changedFiles];
        this.changedFiles.clear();
        result = await extendAnalysis({ ...this.remoteBundle, files: changedFiles });
      } else {
        result = await analyzeFolders({
          connection: {
            baseURL: this.config.baseURL,
            sessionToken: this.config.snykCodeToken ?? '', // todo: handle the case appropriately
            source: this.config.source,
          },
          analysisOptions: {
            legacy: true,
          },
          fileOptions: {
            paths,
          },
        });
      }

      if (result) {
        this.remoteBundle = result;

        if (result.analysisResults.type == 'legacy') {
          this.analyzer.setAnalysisResults(result.analysisResults);
        }
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

        this.viewManagerService.refreshCodeAnalysisViews(enabledFeatures);
        this.suggestionProvider.checkCurrentSuggestion();
      }
    } catch (err) {
      this.analysisFinished();
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
      this.analysisFinished();
    }
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
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(i * 1000);

      // eslint-disable-next-line no-await-in-loop
      settings = await getSastSettings();
      if (settings.sastEnabled) {
        return true;
      }
    }

    return false;
  }

  addChangedFile(filePath: string): void {
    this.changedFiles.add(filePath);
  }

  dispose(): void {
    this.progress.removeAllListeners();
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
