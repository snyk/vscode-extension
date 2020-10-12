import * as vscode from "vscode";
import {
  AnalyzerInterface,
  ExtensionInterface,
  IssuesListOptionsInterface,
  openedTextEditorType,
  completeFileSuggestionType
} from '../../../interfaces/DeepCodeInterfaces';
import {
  updateFileReviewResultsPositions,
  createIssueCorrectRange,
  createIssuesMarkersDecorationOptions,
  createIssueRelatedInformation,
  createDeepCodeSeveritiesMap,
  getDeepCodeSeverity,
  findCompleteSuggestion,
  findSuggestionByMessage,
} from '../../utils/analysisUtils';
import { DEEPCODE_NAME } from "../../constants/general";
import { TELEMETRY_EVENTS } from "../../constants/telemetry";
import { ISSUES_MARKERS_DECORATION_TYPE } from "../../constants/analysis";
import { errorsLogs } from "../../messages/errorsServerLogMessages";

import { IFileSuggestion, IFilePath, ISuggestion, IAnalysisResult } from '@deepcode/tsc';

import { DisposableCodeActionsProvider } from "../deepCodeProviders/codeActionsProvider/DeepCodeIssuesActionsProvider";
import { DisposableHoverProvider } from "../deepCodeProviders/hoverProvider/DeepCodeHoverProvider";

class DeepCodeAnalyzer implements AnalyzerInterface {
  private SEVERITIES: {
    [key: number]: { name: vscode.DiagnosticSeverity; show: boolean };
  };
  private extension: ExtensionInterface | undefined;
  private issuesMarkersdecorationType: vscode.TextEditorDecorationType | undefined;
  public deepcodeReview: vscode.DiagnosticCollection | undefined;
  public analysisResults: IAnalysisResult;

  // Deprecated:
  private ignoreActionsProvider: vscode.Disposable | undefined;
  private issueHoverProvider: vscode.Disposable | undefined;

  public constructor() {
    this.SEVERITIES = createDeepCodeSeveritiesMap();
    this.deepcodeReview = vscode.languages.createDiagnosticCollection(DEEPCODE_NAME);

    this.ignoreActionsProvider = new DisposableCodeActionsProvider(this.deepcodeReview, {
      findSuggestion: this.findSuggestion.bind(this),
      trackIgnoreSuggestion: this.trackIgnoreSuggestion.bind(this),
    });
    this.issueHoverProvider = new DisposableHoverProvider(this.deepcodeReview);
  }

  public activate(extension: ExtensionInterface) {
    this.extension = extension;
  }

  public getFullSuggestion(suggestionId: string, uri: vscode.Uri, position: vscode.Range): completeFileSuggestionType | undefined {
    return findCompleteSuggestion(this.analysisResults, suggestionId, uri, position);
  }

  public findSuggestion(suggestionName: string): ISuggestion | undefined {
    return findSuggestionByMessage(this.analysisResults, suggestionName);
  }

  public trackIgnoreSuggestion(vscodeSeverity: number, options: { [key: string]: any }): void {
    if (!this.extension) return;
    options.data = {
      severity: getDeepCodeSeverity(vscodeSeverity),
      ...options.data,
    };
    this.extension.processEvent(TELEMETRY_EVENTS.ignoreSuggestion, options);
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
    const message: string = suggestion.message;
    return {
      code: '',
      message,
      range: createIssueCorrectRange(issuePositions),
      severity: this.SEVERITIES[suggestion.severity].name,
      source: DEEPCODE_NAME,
      //issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation({
          markersList: issuePositions.markers,
          fileUri,
          message,
        }),
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
    if (editor && this.deepcodeReview && this.deepcodeReview.has(editor.document.uri)) {
      this.clearPrevIssuesMarkersDecoration();
      this.issuesMarkersdecorationType = vscode.window.createTextEditorDecorationType(ISSUES_MARKERS_DECORATION_TYPE);
      const issuesMarkersDecorationsOptions = createIssuesMarkersDecorationOptions(
        this.deepcodeReview.get(editor.document.uri),
      );
      editor.setDecorations(this.issuesMarkersdecorationType, issuesMarkersDecorationsOptions);
    }
  }

  public async createReviewResults(): Promise<void> {
    if (!this.deepcodeReview) {
      return;
    }
    this.deepcodeReview.clear();

    const { files, suggestions } = this.analysisResults;
    for (const filePath in files) {
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
      this.deepcodeReview.set(fileUri, [...issues]);
    }

    this.setIssuesMarkersDecoration();
  }

  public async updateReviewResultsPositions(
    extension: ExtensionInterface,
    updatedFile: openedTextEditorType,
  ): Promise<void> {
    try {
      if (
        !this.deepcodeReview ||
        !this.deepcodeReview.has(updatedFile.document.uri) ||
        !updatedFile.contentChanges.length ||
        !updatedFile.contentChanges[0].range
      ) {
        return;
      }
      const fileIssuesList: IFilePath = await updateFileReviewResultsPositions(this.analysisResults, updatedFile);
      // Opening a project directory instead of a workspace leads to empty updatedFile.workspace field
      const workspace = updatedFile.workspace;
      const filepath = updatedFile.filePathInWorkspace || updatedFile.fullPath.replace(workspace, '');
      this.analysisResults.files[filepath] = { ...fileIssuesList };
      if (this.deepcodeReview) {
        const issues = this.createIssuesList({
          fileIssuesList,
          suggestions: this.analysisResults.suggestions,
          fileUri: vscode.Uri.file(updatedFile.fullPath),
        });
        this.deepcodeReview.set(vscode.Uri.file(updatedFile.fullPath), [...issues]);
        this.setIssuesMarkersDecoration();
      }
    } catch (err) {
      await extension.processError(err, {
        message: errorsLogs.updateReviewPositions,
        bundleId: extension.remoteBundle.bundleId,
        data: {
          [updatedFile.filePathInWorkspace]: updatedFile.contentChanges,
        },
      });
    }
  }
}

export default DeepCodeAnalyzer;
