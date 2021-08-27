import { IAnalysisResult, IFilePath, IFileSuggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import {
  DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
  DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME,
} from '../constants/analysis';
import { errorsLogs } from '../../common/messages/errorsServerLogMessages';
import {
  checkCompleteSuggestion,
  createIssueCorrectRange,
  createIssueRelatedInformation,
  createSnykSeveritiesMap,
  findCompleteSuggestion,
  findSuggestionByMessage,
  isSecurityTypeSuggestion,
  updateFileReviewResultsPositions,
} from '../utils/analysisUtils';
import { IExtension } from '../../base/modules/interfaces';
import {
  ISnykCodeAnalyzer,
  completeFileSuggestionType,
  IIssuesListOptions,
  openedTextEditorType,
  ISnykCodeResult,
  ICodeSuggestion,
} from '../interfaces';
import { DisposableHoverProvider } from '../hoverProvider/hoverProvider';
import { DisposableCodeActionsProvider } from '../codeActionsProvider/issuesActionsProvider';

class SnykCodeAnalyzer implements ISnykCodeAnalyzer {
  private SEVERITIES: {
    [key: number]: { name: vscode.DiagnosticSeverity; show: boolean };
  };
  public readonly codeQualityReview: vscode.DiagnosticCollection | undefined;
  public readonly codeSecurityReview: vscode.DiagnosticCollection | undefined;
  private analysisResults: ISnykCodeResult;

  public constructor() {
    this.SEVERITIES = createSnykSeveritiesMap();
    this.codeSecurityReview = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME);
    this.codeQualityReview = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME);

    new DisposableCodeActionsProvider(this.codeSecurityReview, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      findSuggestion: this.findSuggestion.bind(this),
    });
    new DisposableCodeActionsProvider(this.codeQualityReview, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      findSuggestion: this.findSuggestion.bind(this),
    });
    new DisposableHoverProvider(this.codeSecurityReview);
    new DisposableHoverProvider(this.codeQualityReview);
  }

  public setAnalysisResults(results: IAnalysisResult): void {
    Object.values(results.suggestions).forEach(suggestion => {
      suggestion['isSecurityType'] = isSecurityTypeSuggestion(suggestion);
    });

    this.analysisResults = results as ISnykCodeResult;
  }

  public getAnalysisResults(): ISnykCodeResult {
    return this.analysisResults;
  }

  public getFullSuggestion(
    suggestionId: string,
    uri: vscode.Uri,
    position: vscode.Range,
  ): completeFileSuggestionType | undefined {
    return findCompleteSuggestion(this.analysisResults, suggestionId, uri, position);
  }

  public checkFullSuggestion(suggestion: completeFileSuggestionType): boolean {
    return checkCompleteSuggestion(this.analysisResults, suggestion);
  }

  public findSuggestion(suggestionName: string): ICodeSuggestion | undefined {
    return findSuggestionByMessage(this.analysisResults, suggestionName);
  }

  private createIssueDiagnosticInfo({
    issuePositions,
    suggestion,
    fileUri,
  }: {
    issuePositions: IFileSuggestion;
    suggestion: ICodeSuggestion;
    fileUri: vscode.Uri;
  }): vscode.Diagnostic {
    const { message } = suggestion;
    return {
      code: '',
      message,
      range: createIssueCorrectRange(issuePositions),
      severity: this.SEVERITIES[suggestion.severity].name,
      source: suggestion.isSecurityType
        ? DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME
        : DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
      // issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation(issuePositions.markers, fileUri, message),
      }),
    };
  }

  private createIssuesList(
    options: IIssuesListOptions,
  ): [securityIssues: vscode.Diagnostic[], qualityIssues: vscode.Diagnostic[]] {
    const securityIssues: vscode.Diagnostic[] = [];
    const qualityIssues: vscode.Diagnostic[] = [];

    const { fileIssuesList, suggestions, fileUri } = options;

    for (const issue in fileIssuesList) {
      if (!this.SEVERITIES[suggestions[issue].severity].show) {
        continue;
      }

      const isSecurityType = suggestions[issue].isSecurityType;
      const issueList = isSecurityType ? securityIssues : qualityIssues;
      for (const issuePositions of fileIssuesList[issue]) {
        issueList.push(
          this.createIssueDiagnosticInfo({
            issuePositions,
            suggestion: suggestions[issue],
            fileUri,
          }),
        );
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

    const { files, suggestions } = this.analysisResults;
    for (const filePath in files) {
      if (!files.hasOwnProperty(filePath)) {
        continue;
      }

      const fileUri = vscode.Uri.file(filePath);
      if (!fileUri) {
        return;
      }
      const fileIssuesList = files[filePath];
      const [securityIssues, qualityIssues] = this.createIssuesList({
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
      const fileIssuesList: IFilePath = updateFileReviewResultsPositions(this.analysisResults, updatedFile);
      const [securityIssues, qualityIssues] = this.createIssuesList({
        fileIssuesList,
        suggestions: this.analysisResults.suggestions,
        fileUri: vscode.Uri.file(updatedFile.fullPath),
      });
      if (isSecurityReviewFile) {
        this.codeSecurityReview?.set(vscode.Uri.file(updatedFile.fullPath), [...securityIssues]);
      } else if (isQualityReviewFile) {
        this.codeQualityReview?.set(vscode.Uri.file(updatedFile.fullPath), [...qualityIssues]);
      }
    } catch (err) {
      await extension.processError(err, {
        message: errorsLogs.updateReviewPositions,
        bundleId: extension.snykCode.remoteBundle.bundleId,
        data: {
          [updatedFile.fullPath]: updatedFile.contentChanges,
        },
      });
    }
  }
}

export default SnykCodeAnalyzer;
