import { AnalysisResultLegacy, AnalysisSeverity, FilePath, FileSuggestion } from '@snyk/code-client';
import { IExtension } from '../../base/modules/interfaces';
import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../../common/logger/interfaces';
import { errorsLogs } from '../../common/messages/errors';
import { IHoverAdapter } from '../../common/vscode/hover';
import { IVSCodeLanguages } from '../../common/vscode/languages';
import { IMarkdownStringAdapter } from '../../common/vscode/markdownString';
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  Disposable,
  Range,
  Uri,
} from '../../common/vscode/types';
import { IUriAdapter } from '../../common/vscode/uri';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import {
  DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
  DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME,
} from '../constants/analysis';
import { ISnykCodeErrorHandler } from '../error/snykCodeErrorHandler';
import { DisposableHoverProvider } from '../hoverProvider/hoverProvider';
import {
  completeFileSuggestionType,
  ICodeSuggestion,
  IIssuesListOptions,
  ISnykCodeAnalyzer,
  ISnykCodeResult,
  openedTextEditorType,
} from '../interfaces';
import {
  checkCompleteSuggestion,
  createIssueCorrectRange,
  createIssueRelatedInformation,
  createSnykSeveritiesMap,
  findCompleteSuggestion,
  isSecurityTypeSuggestion,
  updateFileReviewResultsPositions,
} from '../utils/analysisUtils';

class SnykCodeAnalyzer implements ISnykCodeAnalyzer {
  protected disposables: Disposable[] = [];

  private SEVERITIES: {
    [key: number]: { name: DiagnosticSeverity };
  };
  public readonly codeQualityReview: DiagnosticCollection | undefined;
  public readonly codeSecurityReview: DiagnosticCollection | undefined;
  private analysisResults: ISnykCodeResult;

  private readonly diagnosticSuggestion = new Map<Diagnostic, ICodeSuggestion>();

  public constructor(
    private readonly logger: ILog,
    private readonly languages: IVSCodeLanguages,
    private readonly workspace: IVSCodeWorkspace,
    private readonly analytics: IAnalytics,
    private readonly errorHandler: ISnykCodeErrorHandler,
    private readonly uriAdapter: IUriAdapter,
    private readonly configuration: IConfiguration,
  ) {
    this.SEVERITIES = createSnykSeveritiesMap();
    this.codeSecurityReview = this.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME);
    this.codeQualityReview = this.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME);

    this.disposables.push(this.codeSecurityReview, this.codeQualityReview);
  }

  public registerCodeActionProviders(
    codeSecurityCodeActionsProvider: Disposable,
    codeQualityCodeActionsProvider: Disposable,
  ) {
    this.disposables.push(codeSecurityCodeActionsProvider, codeQualityCodeActionsProvider);
  }

  public registerHoverProviders(
    codeSecurityHoverAdapter: IHoverAdapter,
    codeQualityHoverAdapter: IHoverAdapter,
    markdownStringAdapter: IMarkdownStringAdapter,
  ): void {
    this.disposables.push(
      new DisposableHoverProvider(this, this.logger, this.languages, this.analytics, markdownStringAdapter).register(
        this.codeSecurityReview,
        codeSecurityHoverAdapter,
      ),
      new DisposableHoverProvider(this, this.logger, this.languages, this.analytics, markdownStringAdapter).register(
        this.codeQualityReview,
        codeQualityHoverAdapter,
      ),
    );
  }

  public setAnalysisResults(results: AnalysisResultLegacy): void {
    Object.values(results.suggestions).forEach(suggestion => {
      suggestion['isSecurityType'] = isSecurityTypeSuggestion(suggestion);
    });

    this.analysisResults = results as ISnykCodeResult;
  }

  public getAnalysisResults(): ISnykCodeResult {
    return this.analysisResults;
  }

  dispose(): void {
    this.diagnosticSuggestion.clear();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  public getFullSuggestion(suggestionId: string, uri: Uri, position: Range): completeFileSuggestionType | undefined {
    return findCompleteSuggestion(this.analysisResults, suggestionId, uri, position, this.languages);
  }

  public checkFullSuggestion(suggestion: completeFileSuggestionType): boolean {
    return checkCompleteSuggestion(this.analysisResults, suggestion, this.uriAdapter);
  }

  public findSuggestion(diagnostic: Diagnostic): ICodeSuggestion | undefined {
    return this.diagnosticSuggestion.get(diagnostic);
  }

  private createIssueDiagnosticInfo({
    issuePositions,
    suggestion,
    fileUri,
  }: {
    issuePositions: FileSuggestion;
    suggestion: ICodeSuggestion;
    fileUri: Uri;
  }): Diagnostic {
    const { message } = suggestion;
    return {
      code: '',
      message,
      range: createIssueCorrectRange(issuePositions, this.languages),
      severity: this.SEVERITIES[suggestion.severity].name,
      source: suggestion.isSecurityType
        ? DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME
        : DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
      // issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation(
          issuePositions.markers,
          fileUri.path,
          message,
          this.languages,
          this.workspace,
          this.uriAdapter,
        ),
      }),
    };
  }

  private createDiagnostics(options: IIssuesListOptions): [securityIssues: Diagnostic[], qualityIssues: Diagnostic[]] {
    const securityIssues: Diagnostic[] = [];
    const qualityIssues: Diagnostic[] = [];

    const { fileIssuesList, suggestions, fileUri } = options;

    for (const issue in fileIssuesList) {
      const isSecurityType = suggestions[issue].isSecurityType;

      if (!SnykCodeAnalyzer.isIssueVisible(this.configuration, isSecurityType, suggestions[issue].severity)) {
        continue;
      }

      const issueList = isSecurityType ? securityIssues : qualityIssues;
      for (const issuePositions of fileIssuesList[issue]) {
        const suggestion = suggestions[issue];
        const diagnostic = this.createIssueDiagnosticInfo({
          issuePositions,
          suggestion,
          fileUri,
        });

        this.diagnosticSuggestion.set(diagnostic, suggestion);
        issueList.push(diagnostic);
      }
    }

    return [securityIssues, qualityIssues];
  }

  public createReviewResults(): void {
    if (!this.codeSecurityReview || !this.codeQualityReview) {
      return;
    }
    this.codeSecurityReview.clear();
    this.codeQualityReview.clear();
    this.diagnosticSuggestion.clear();

    if (!this.analysisResults) {
      return;
    }

    const { files, suggestions } = this.analysisResults;
    for (const filePath in files) {
      if (!files.hasOwnProperty(filePath)) {
        continue;
      }

      const fileUri = this.uriAdapter.file(filePath);
      if (!fileUri) {
        return;
      }
      const fileIssuesList = files[filePath];
      const [securityIssues, qualityIssues] = this.createDiagnostics({
        fileIssuesList,
        suggestions,
        fileUri,
      });

      if (securityIssues.length > 0) this.codeSecurityReview.set(fileUri, [...securityIssues]);
      if (qualityIssues.length > 0) this.codeQualityReview.set(fileUri, [...qualityIssues]);
    }
  }

  public async updateReviewResultsPositions(extension: IExtension, updatedFile: openedTextEditorType): Promise<void> {
    try {
      const isSecurityReviewFile = this.codeSecurityReview && this.codeSecurityReview.has(updatedFile.document.uri);
      const isQualityReviewFile = this.codeQualityReview && this.codeQualityReview.has(updatedFile.document.uri);

      if (
        (!isSecurityReviewFile && !isQualityReviewFile) ||
        !updatedFile.contentChanges.length ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !updatedFile.contentChanges[0].range
      ) {
        return;
      }
      const fileIssuesList: FilePath = updateFileReviewResultsPositions(this.analysisResults, updatedFile);
      const [securityIssues, qualityIssues] = this.createDiagnostics({
        fileIssuesList,
        suggestions: this.analysisResults.suggestions,
        fileUri: this.uriAdapter.file(updatedFile.fullPath),
      });
      if (isSecurityReviewFile) {
        this.codeSecurityReview?.set(this.uriAdapter.file(updatedFile.fullPath), [...securityIssues]);
      } else if (isQualityReviewFile) {
        this.codeQualityReview?.set(this.uriAdapter.file(updatedFile.fullPath), [...qualityIssues]);
      }
    } catch (err) {
      await this.errorHandler.processError(err, {
        message: errorsLogs.updateReviewPositions,
        bundleId: extension.snykCode.remoteBundle?.fileBundle.bundleHash,
        data: {
          [updatedFile.fullPath]: updatedFile.contentChanges,
        },
      });
    }
  }

  static isIssueVisible(configuration: IConfiguration, isSecurityType: boolean, severity: AnalysisSeverity): boolean {
    if (isSecurityType && !configuration.getFeaturesConfiguration()?.codeSecurityEnabled) {
      return false;
      // deepcode ignore DuplicateIfBody: readability
    } else if (!isSecurityType && !configuration.getFeaturesConfiguration()?.codeQualityEnabled) {
      return false;
    }

    switch (severity) {
      case AnalysisSeverity.critical:
        return configuration.severityFilter.high;
      case AnalysisSeverity.warning:
        return configuration.severityFilter.medium;
      case AnalysisSeverity.info:
        return configuration.severityFilter.low;
      default:
        return false;
    }
  }

  // Refreshes reported diagnostic
  public refreshDiagnostics = () => this.createReviewResults();
}

export default SnykCodeAnalyzer;
