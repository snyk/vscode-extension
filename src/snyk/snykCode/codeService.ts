import { AnalysisSeverity, analyzeFolders, extendAnalysis, FileAnalysis } from '@snyk/code-client';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { IAnalytics, SupportedAnalysisProperties } from '../common/analytics/itly';
import { FeaturesConfiguration, IConfiguration } from '../common/configuration/configuration';
import { IDE_NAME } from '../common/constants/general';
import { ErrorHandler } from '../common/error/errorHandler';
import { ILog } from '../common/logger/interfaces';
import { Logger } from '../common/logger/logger';
import { IViewManagerService } from '../common/services/viewManagerService';
import { User } from '../common/user';
import { IWebViewProvider } from '../common/views/webviewProvider';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { Disposable } from '../common/vscode/types';
import { IUriAdapter } from '../common/vscode/uri';
import { IVSCodeWindow } from '../common/vscode/window';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import SnykCodeAnalyzer from './analyzer/analyzer';
import { Progress } from './analyzer/progress';
import { ISnykCodeErrorHandler } from './error/snykCodeErrorHandler';
import { IFalsePositiveApi } from './falsePositive/api/falsePositiveApi';
import { FalsePositive } from './falsePositive/falsePositive';
import { ISnykCodeAnalyzer } from './interfaces';
import { messages as analysisMessages } from './messages/analysis';
import { messages } from './messages/error';
import { IssueUtils } from './utils/issueUtils';
import {
  FalsePositiveWebviewModel,
  FalsePositiveWebviewProvider,
} from './views/falsePositive/falsePositiveWebviewProvider';
import { ICodeSuggestionWebviewProvider } from './views/interfaces';
import { CodeSuggestionWebviewProvider } from './views/suggestion/codeSuggestionWebviewProvider';

export interface ISnykCodeService extends AnalysisStatusProvider, Disposable {
  analyzer: ISnykCodeAnalyzer;
  analysisStatus: string;
  analysisProgress: string;
  remoteBundle: FileAnalysis;
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;
  readonly falsePositiveProvider: IWebViewProvider<FalsePositiveWebviewModel>;
  hasError: boolean;
  hasTransientError: boolean;

  startAnalysis(paths: string[], manual: boolean, reportTriggeredEvent: boolean): Promise<void>;
  updateStatus(status: string, progress: string): void;
  errorEncountered(error: Error): void;
  addChangedFile(filePath: string): void;
  activateWebviewProviders(): void;
  reportFalsePositive(
    falsePositive: FalsePositive,
    isSecurityTypeIssue: boolean,
    issueSeverity: AnalysisSeverity,
  ): Promise<void>;
}

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  remoteBundle: FileAnalysis;
  analyzer: ISnykCodeAnalyzer;
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;
  readonly falsePositiveProvider: IWebViewProvider<FalsePositiveWebviewModel>;

  private changedFiles: Set<string> = new Set();

  private progress: Progress;
  private _analysisStatus = '';
  private _analysisProgress = '';
  private temporaryFailed = false;
  private failed = false;

  constructor(
    readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly viewManagerService: IViewManagerService,
    private readonly workspace: IVSCodeWorkspace,
    readonly window: IVSCodeWindow,
    private readonly user: User,
    private readonly falsePositiveApi: IFalsePositiveApi,
    private readonly logger: ILog,
    private readonly analytics: IAnalytics,
    readonly languages: IVSCodeLanguages,
    private readonly errorHandler: ISnykCodeErrorHandler,
    private readonly uriAdapter: IUriAdapter,
  ) {
    super();
    this.analyzer = new SnykCodeAnalyzer(logger, languages, analytics, errorHandler, this.uriAdapter);

    this.falsePositiveProvider = new FalsePositiveWebviewProvider(
      this,
      this.window,
      extensionContext,
      this.logger,
      this.analytics,
    );
    this.suggestionProvider = new CodeSuggestionWebviewProvider(
      config,
      this.analyzer,
      window,
      this.falsePositiveProvider,
      extensionContext,
      this.logger,
      languages,
    );

    this.progress = new Progress(this, viewManagerService, this.workspace);
    this.progress.bindListeners();
  }

  get hasError(): boolean {
    return this.failed;
  }
  get hasTransientError(): boolean {
    return this.temporaryFailed;
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
      Logger.info(analysisMessages.started);

      // reset error state
      this.temporaryFailed = false;
      this.failed = false;

      this.reportAnalysisIsTriggered(reportTriggeredEvent, enabledFeatures, manualTrigger);
      this.analysisStarted();

      let result: FileAnalysis | null = null;
      if (this.changedFiles.size && this.remoteBundle) {
        const changedFiles = [...this.changedFiles];
        result = await extendAnalysis({ ...this.remoteBundle, files: changedFiles });
      } else {
        result = await analyzeFolders({
          connection: {
            baseURL: this.config.snykCodeBaseURL,
            sessionToken: this.config.snykCodeToken ?? '', // todo: handle the case appropriately
            source: this.config.source,
          },
          analysisOptions: {
            legacy: true,
          },
          fileOptions: {
            paths,
          },
          analysisContext: {
            flow: this.config.source,
            initiator: 'IDE',
            orgDisplayName: this.config.organization,
          },
        });
      }

      if (result) {
        this.remoteBundle = result;

        if (result.analysisResults.type == 'legacy') {
          this.analyzer.setAnalysisResults(result.analysisResults);
        }
        this.analyzer.createReviewResults();

        Logger.info(analysisMessages.finished);

        if (enabledFeatures?.codeSecurityEnabled) {
          this.analytics.logAnalysisIsReady({
            ide: IDE_NAME,
            analysisType: 'Snyk Code Security',
            result: 'Success',
          });
        }
        if (enabledFeatures?.codeQualityEnabled) {
          this.analytics.logAnalysisIsReady({
            ide: IDE_NAME,
            analysisType: 'Snyk Code Quality',
            result: 'Success',
          });
        }

        this.suggestionProvider.checkCurrentSuggestion();

        // cleanup analysis state
        this.changedFiles.clear();
      }
    } catch (err) {
      this.temporaryFailed = true;
      await this.errorHandler.processError(err, undefined, () => {
        this.errorEncountered();
      });

      if (enabledFeatures?.codeSecurityEnabled) {
        this.analytics.logAnalysisIsReady({
          ide: IDE_NAME,
          analysisType: 'Snyk Code Security',
          result: 'Error',
        });
      }
      if (enabledFeatures?.codeQualityEnabled) {
        this.analytics.logAnalysisIsReady({
          ide: IDE_NAME,
          analysisType: 'Snyk Code Quality',
          result: 'Error',
        });
      }
    } finally {
      this.analysisFinished();
      this.viewManagerService.refreshCodeAnalysisViews(enabledFeatures);
    }
  }

  private reportAnalysisIsTriggered(
    reportTriggeredEvent: boolean,
    enabledFeatures: FeaturesConfiguration | undefined,
    manualTrigger: boolean,
  ) {
    if (reportTriggeredEvent) {
      const analysisType: SupportedAnalysisProperties[] = [];
      if (enabledFeatures?.codeSecurityEnabled) analysisType.push('Snyk Code Security');
      if (enabledFeatures?.codeQualityEnabled) analysisType.push('Snyk Code Quality');

      if (analysisType) {
        this.analytics.logAnalysisIsTriggered({
          analysisType: analysisType as [SupportedAnalysisProperties, ...SupportedAnalysisProperties[]],
          ide: IDE_NAME,
          triggeredByUser: manualTrigger,
        });
      }
    }
  }

  updateStatus(status: string, progress: string): void {
    this._analysisStatus = status;
    this._analysisProgress = progress;
  }

  errorEncountered(): void {
    this.temporaryFailed = false;
    this.failed = true;
    this.logger.error(analysisMessages.failed);
  }

  addChangedFile(filePath: string): void {
    this.changedFiles.add(filePath);
  }

  activateWebviewProviders(): void {
    this.suggestionProvider.activate();
    this.falsePositiveProvider.activate();
  }

  async reportFalsePositive(
    falsePositive: FalsePositive,
    isSecurityTypeIssue: boolean,
    issueSeverity: AnalysisSeverity,
  ): Promise<void> {
    try {
      await this.falsePositiveApi.report(falsePositive, this.user);

      this.analytics.logFalsePositiveIsSubmitted({
        issueId: falsePositive.id,
        issueType: IssueUtils.getIssueType(isSecurityTypeIssue),
        severity: IssueUtils.severityAsText(issueSeverity),
      });
    } catch (e) {
      ErrorHandler.handle(e, this.logger, messages.reportFalsePositiveFailed);
    }
  }

  dispose(): void {
    this.progress.removeAllListeners();
    this.analyzer.dispose();
  }
}
