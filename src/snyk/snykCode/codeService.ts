import { AnalysisSeverity, analyzeFolders, extendAnalysis, FileAnalysis } from '@snyk/code-client';
import { ConnectionOptions } from '@snyk/code-client/dist/http';
import { v4 as uuidv4 } from 'uuid';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { IAnalytics, SupportedAnalysisProperties } from '../common/analytics/itly';
import { FeaturesConfiguration, IConfiguration } from '../common/configuration/configuration';
import { getTrustedFolders } from '../common/configuration/trustedFolders';
import { IDE_NAME } from '../common/constants/general';
import { ErrorHandler } from '../common/error/errorHandler';
import { ILog } from '../common/logger/interfaces';
import { Logger } from '../common/logger/logger';
import { messages as generalAnalysisMessages } from '../common/messages/analysisMessages';
import { LearnService } from '../common/services/learnService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { User } from '../common/user';
import { IWebViewProvider } from '../common/views/webviewProvider';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { HoverAdapter } from '../common/vscode/hover';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { IMarkdownStringAdapter } from '../common/vscode/markdownString';
import { Diagnostic, Disposable } from '../common/vscode/types';
import { IUriAdapter } from '../common/vscode/uri';
import { IVSCodeWindow } from '../common/vscode/window';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import SnykCodeAnalyzer from './analyzer/analyzer';
import { Progress } from './analyzer/progress';
import { DisposableCodeActionsProvider } from './codeActions/disposableCodeActionsProvider';
import { ICodeSettings } from './codeSettings';
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
  readonly remoteBundle: FileAnalysis | null;
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;
  readonly falsePositiveProvider: IWebViewProvider<FalsePositiveWebviewModel>;
  hasError: boolean;
  hasTransientError: boolean;
  isAnyWorkspaceFolderTrusted: boolean;

  startAnalysis(paths: string[], manual: boolean, reportTriggeredEvent: boolean): Promise<void>;
  clearBundle(): void;
  updateStatus(status: string, progress: string): void;
  errorEncountered(requestId: string): void;
  addChangedFile(filePath: string): void;
  activateWebviewProviders(): void;
  reportFalsePositive(
    falsePositive: FalsePositive,
    isSecurityTypeIssue: boolean,
    issueSeverity: AnalysisSeverity,
  ): Promise<void>;
}

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  remoteBundle: FileAnalysis | null;
  analyzer: ISnykCodeAnalyzer;
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;
  readonly falsePositiveProvider: IWebViewProvider<FalsePositiveWebviewModel>;

  private changedFiles: Set<string> = new Set();

  private progress: Progress;
  private _analysisStatus = '';
  private _analysisProgress = '';
  private temporaryFailed = false;
  private failed = false;
  private _isAnyWorkspaceFolderTrusted = true;

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
    codeSettings: ICodeSettings,
    private readonly learnService: LearnService,
    private readonly markdownStringAdapter: IMarkdownStringAdapter,
  ) {
    super();
    this.analyzer = new SnykCodeAnalyzer(
      logger,
      languages,
      workspace,
      analytics,
      errorHandler,
      this.uriAdapter,
      this.config,
    );
    this.registerAnalyzerProviders(this.analyzer);

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
      workspace,
      codeSettings,
      this.learnService,
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
  get isAnyWorkspaceFolderTrusted(): boolean {
    return this._isAnyWorkspaceFolderTrusted;
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
    const requestId = uuidv4();

    paths = getTrustedFolders(this.config, paths);
    if (!paths.length) {
      this._isAnyWorkspaceFolderTrusted = false;
      this.viewManagerService.refreshCodeAnalysisViews(enabledFeatures);
      this.logger.info(`Skipping Code scan. ${generalAnalysisMessages.noWorkspaceTrustDescription}`);
      return;
    }
    this._isAnyWorkspaceFolderTrusted = true;

    try {
      Logger.info(analysisMessages.started);

      // reset error state
      this.temporaryFailed = false;
      this.failed = false;

      this.reportAnalysisIsTriggered(reportTriggeredEvent, enabledFeatures, manualTrigger);
      this.analysisStarted();

      const snykCodeToken = await this.config.snykCodeToken;

      let result: FileAnalysis | null = null;
      if (this.changedFiles.size && this.remoteBundle) {
        const changedFiles = [...this.changedFiles];
        result = await extendAnalysis({
          ...this.remoteBundle,
          files: changedFiles,
          connection: this.getConnectionOptions(requestId, snykCodeToken),
        });
      } else {
        result = await analyzeFolders({
          connection: this.getConnectionOptions(requestId, snykCodeToken),
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
      await this.errorHandler.processError(err, undefined, requestId, () => {
        this.errorEncountered(requestId);
      });

      if (enabledFeatures?.codeSecurityEnabled && this.errorHandler.connectionRetryLimitExhausted) {
        this.analytics.logAnalysisIsReady({
          ide: IDE_NAME,
          analysisType: 'Snyk Code Security',
          result: 'Error',
        });
      }
      if (enabledFeatures?.codeQualityEnabled && this.errorHandler.connectionRetryLimitExhausted) {
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

  clearBundle() {
    this.remoteBundle = null;
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

  errorEncountered(requestId: string): void {
    this.temporaryFailed = false;
    this.failed = true;
    this.logger.error(analysisMessages.failed(requestId));
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

  private getConnectionOptions(requestId: string, snykCodeToken: string | undefined): ConnectionOptions {
    if (!snykCodeToken) {
      throw new Error('Snyk token must be filled to obtain connection options');
    }

    return {
      baseURL: this.config.snykCodeBaseURL,
      sessionToken: snykCodeToken,
      source: this.config.source,
      requestId,
      base64Encoding: true,
    };
  }

  private registerAnalyzerProviders(analyzer: ISnykCodeAnalyzer) {
    analyzer.registerHoverProviders(new HoverAdapter(), new HoverAdapter(), this.markdownStringAdapter);
    analyzer.registerCodeActionProviders(
      new DisposableCodeActionsProvider(
        analyzer.codeSecurityReview,
        {
          findSuggestion: (diagnostic: Diagnostic) => analyzer.findSuggestion(diagnostic),
        },
        this.analytics,
      ),
      new DisposableCodeActionsProvider(
        analyzer.codeQualityReview,
        {
          findSuggestion: (diagnostic: Diagnostic) => analyzer.findSuggestion(diagnostic),
        },
        this.analytics,
      ),
    );
  }
}
