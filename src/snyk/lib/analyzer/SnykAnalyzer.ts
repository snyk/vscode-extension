import { IAnalysisResult, IFilePath, IFileSuggestion, ISuggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import {
  AnalyzerInterface,
  completeFileSuggestionType,
  ExtensionInterface,
  IssuesListOptionsInterface,
  openedTextEditorType,
} from '../../../interfaces/SnykInterfaces';
import {
  DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
  DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME,
} from '../../constants/analysis';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import {
  checkCompleteSuggestion,
  createIssueCorrectRange,
  createIssueRelatedInformation,
  createSnykSeveritiesMap,
  findCompleteSuggestion,
  findSuggestionByMessage,
  getSnykSeverity,
  updateFileReviewResultsPositions,
} from '../../utils/analysisUtils';

class SnykAnalyzer implements AnalyzerInterface {
  private SEVERITIES: {
    [key: number]: { name: vscode.DiagnosticSeverity; show: boolean };
  };
  public readonly codeQualityReview: vscode.DiagnosticCollection | undefined;
  public readonly codeSecurityReview: vscode.DiagnosticCollection | undefined;
  public analysisResults: IAnalysisResult;

  public constructor() {
    this.SEVERITIES = createSnykSeveritiesMap();
    this.codeSecurityReview = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME);
    this.codeQualityReview = vscode.languages.createDiagnosticCollection(DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME);
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

  public findSuggestion(suggestionName: string): ISuggestion | undefined {
    return findSuggestionByMessage(this.analysisResults, suggestionName);
  }

  public trackIgnoreSuggestion(vscodeSeverity: number, options: { [key: string]: any }): void {
    // eslint-disable-next-line no-param-reassign
    options.data = {
      severity: getSnykSeverity(vscodeSeverity),
      ...options.data,
    };
  }

  private createIssueDiagnosticInfo({
    issuePositions,
    suggestion,
    fileUri,
    isSecurityType,
  }: {
    issuePositions: IFileSuggestion;
    suggestion: ISuggestion;
    fileUri: vscode.Uri;
    isSecurityType: boolean;
  }): vscode.Diagnostic {
    const { message } = suggestion;
    return {
      code: '',
      message,
      range: createIssueCorrectRange(issuePositions),
      severity: this.SEVERITIES[suggestion.severity].name,
      source: isSecurityType ? DIAGNOSTICS_CODE_SECURITY_COLLECTION_NAME : DIAGNOSTICS_CODE_QUALITY_COLLECTION_NAME,
      // issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation(issuePositions.markers, fileUri, message),
      }),
    };
  }

  private createIssuesList(
    options: IssuesListOptionsInterface,
  ): [securityIssues: vscode.Diagnostic[], qualityIssues: vscode.Diagnostic[]] {
    const securityIssues: vscode.Diagnostic[] = [];
    const qualityIssues: vscode.Diagnostic[] = [];

    const { fileIssuesList, suggestions, fileUri } = options;

    for (const issue in fileIssuesList) {
      if (!this.SEVERITIES[suggestions[issue].severity].show) {
        continue;
      }

      const isSecurityType = suggestions[issue].categories.includes('Security');
      const issueList = isSecurityType ? securityIssues : qualityIssues;
      for (const issuePositions of fileIssuesList[issue]) {
        issueList.push(
          this.createIssueDiagnosticInfo({
            issuePositions,
            suggestion: suggestions[issue],
            fileUri,
            isSecurityType,
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

  public async updateReviewResultsPositions(
    extension: ExtensionInterface,
    updatedFile: openedTextEditorType,
  ): Promise<void> {
    try {
      if (
        !this.codeSecurityReview ||
        !this.codeSecurityReview.has(updatedFile.document.uri) ||
        !updatedFile.contentChanges.length ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !updatedFile.contentChanges[0].range
      ) {
        return;
      }
      const fileIssuesList: IFilePath = updateFileReviewResultsPositions(this.analysisResults, updatedFile);
      if (this.codeSecurityReview) {
        const [securityIssues, qualityIssues] = this.createIssuesList({
          fileIssuesList,
          suggestions: this.analysisResults.suggestions,
          fileUri: vscode.Uri.file(updatedFile.fullPath),
        });
        this.codeSecurityReview.set(vscode.Uri.file(updatedFile.fullPath), [...securityIssues]); // todo
      }
    } catch (err) {
      await extension.processError(err, {
        message: errorsLogs.updateReviewPositions,
        bundleId: extension.remoteBundle.bundleId,
        data: {
          [updatedFile.fullPath]: updatedFile.contentChanges,
        },
      });
    }
  }
}

export default SnykAnalyzer;
