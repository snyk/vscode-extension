import { IAnalysisResult, IFilePath, IFileSuggestion, ISuggestion } from '@snyk/code-client';
import * as vscode from 'vscode';
import {
  AnalyzerInterface,
  completeFileSuggestionType,
  ExtensionInterface,
  IssuesListOptionsInterface,
  openedTextEditorType,
} from '../../../interfaces/SnykInterfaces';
import { SNYK_NAME } from '../../constants/general';
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
import { DisposableCodeActionsProvider } from '../snykProviders/codeActionsProvider/SnykIssuesActionsProvider';
import { DisposableHoverProvider } from '../snykProviders/hoverProvider/SnykHoverProvider';

class SnykAnalyzer implements AnalyzerInterface {
  private SEVERITIES: {
    [key: number]: { name: vscode.DiagnosticSeverity; show: boolean };
  };
  private extension: ExtensionInterface | undefined;
  private issuesMarkersdecorationType: vscode.TextEditorDecorationType | undefined;
  public snykReview: vscode.DiagnosticCollection | undefined;
  public analysisResults: IAnalysisResult;

  // Deprecated:
  private ignoreActionsProvider: vscode.Disposable | undefined;
  private issueHoverProvider: vscode.Disposable | undefined;

  public constructor() {
    this.SEVERITIES = createSnykSeveritiesMap();
    this.snykReview = vscode.languages.createDiagnosticCollection(SNYK_NAME);

    this.ignoreActionsProvider = new DisposableCodeActionsProvider(this.snykReview, {
      findSuggestion: this.findSuggestion.bind(this),
      trackIgnoreSuggestion: this.trackIgnoreSuggestion.bind(this),
    });
    this.issueHoverProvider = new DisposableHoverProvider(this.snykReview);
  }

  public activate(extension: ExtensionInterface) {
    this.extension = extension;
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
    if (!this.extension) return;
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
  }: {
    issuePositions: IFileSuggestion;
    suggestion: ISuggestion;
    fileUri: vscode.Uri;
  }): vscode.Diagnostic {
    const { message } = suggestion;
    return {
      code: '',
      message,
      range: createIssueCorrectRange(issuePositions),
      severity: this.SEVERITIES[suggestion.severity].name,
      source: SNYK_NAME,
      // issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation(issuePositions.markers, fileUri, message),
      }),
    };
  }

  private createIssuesList(options: IssuesListOptionsInterface): vscode.Diagnostic[] {
    const issuesList: vscode.Diagnostic[] = [];
    const { fileIssuesList, suggestions, fileUri } = options;

    for (const issue in fileIssuesList) {
      if (!this.SEVERITIES[suggestions[issue].severity].show) {
        continue;
      }
      for (const issuePositions of fileIssuesList[issue]) {
        issuesList.push(
          this.createIssueDiagnosticInfo({
            issuePositions,
            suggestion: suggestions[issue],
            fileUri,
          }),
        );
      }
    }
    return issuesList;
  }

  private clearPrevIssuesMarkersDecoration() {
    if (this.issuesMarkersdecorationType) {
      this.issuesMarkersdecorationType.dispose();
    }
  }

  public setIssuesMarkersDecoration(editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor): void {
    if (editor && this.snykReview && this.snykReview.has(editor.document.uri)) {
      // Deprecated. Markers decoration is super noisy and intersects very often with main issue position
      // this.clearPrevIssuesMarkersDecoration();
      // this.issuesMarkersdecorationType = vscode.window.createTextEditorDecorationType(ISSUES_MARKERS_DECORATION_TYPE);
      // const issuesMarkersDecorationsOptions = createIssuesMarkersDecorationOptions(
      //   this.snykReview.get(editor.document.uri),
      // );
      // Markers decoration is super noisy
      // editor.setDecorations(this.issuesMarkersdecorationType, issuesMarkersDecorationsOptions);
    }
  }

  public createReviewResults(): void {
    if (!this.snykReview) {
      return;
    }
    this.snykReview.clear();

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
      const issues = this.createIssuesList({
        fileIssuesList,
        suggestions,
        fileUri,
      });
      this.snykReview.set(fileUri, [...issues]);
    }

    this.setIssuesMarkersDecoration();
  }

  public async updateReviewResultsPositions(
    extension: ExtensionInterface,
    updatedFile: openedTextEditorType,
  ): Promise<void> {
    try {
      if (
        !this.snykReview ||
        !this.snykReview.has(updatedFile.document.uri) ||
        !updatedFile.contentChanges.length ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !updatedFile.contentChanges[0].range
      ) {
        return;
      }
      const fileIssuesList: IFilePath = updateFileReviewResultsPositions(this.analysisResults, updatedFile);
      if (this.snykReview) {
        const issues = this.createIssuesList({
          fileIssuesList,
          suggestions: this.analysisResults.suggestions,
          fileUri: vscode.Uri.file(updatedFile.fullPath),
        });
        this.snykReview.set(vscode.Uri.file(updatedFile.fullPath), [...issues]);
        this.setIssuesMarkersDecoration();
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
