import { analyzeFolders, constants, extendAnalysis, IFileBundle } from '@snyk/code-client';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { analytics } from '../common/analytics/analytics';
import { SupportedAnalysisProperties } from '../common/analytics/itly';
import { IConfiguration } from '../common/configuration/configuration';
import { IDE_NAME } from '../common/constants/general';
import { IErrorReporting } from '../common/errorReporting/errorReporting';
import { Logger } from '../common/logger/logger';
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
  remoteBundle: IFileBundle;
  suggestionProvider: ICodeSuggestionWebviewProvider;

  startAnalysis(paths: string[], manual: boolean): Promise<void>;
  updateStatus(status: string, progress: string): void;
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
  addChangedFile(filePath: string): void;
  dispose(): void;
}

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  remoteBundle: IFileBundle;
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
    private readonly errorReporting: IErrorReporting,
  ) {
    super();
    this.analyzer = new SnykCodeAnalyzer();
    this.suggestionProvider = new CodeSuggestionWebviewProvider(extensionContext);

    this.progress = new Progress(this, viewManagerService, this.workspace, errorReporting);
    this.progress.bindListeners();
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

      this.analysisStarted();

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

        this.analyzer.setAnalysisResults(result.analysisResults);
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

      this.errorReporting.reportError(err);

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
      await this.sleep(i * 1000);

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
