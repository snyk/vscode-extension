import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import {
  updateFileReviewResultsPositions,
  createDeepCodeProgress,
  createIssueCorrectRange,
  createIssuesMarkersDecorationOptions,
  createIssueRelatedInformation,
  createDeepCodeSeveritiesMap,
  extractSuggestionIdFromSuggestionsMap
} from "../../utils/analysisUtils";
import { httpDelay } from "../../utils/httpUtils";
import { DEEPCODE_NAME } from "../../constants/general";
import {
  ANALYSIS_STATUS,
  ISSUES_MARKERS_DECORATION_TYPE
} from "../../constants/analysis";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";

import { DisposableCodeActionsProvider } from "../deepCodeProviders/codeActionsProvider/DeepCodeIssuesActionsProvider";
import { DisposableHoverProvider } from "../deepCodeProviders/hoverProvider/DeepCodeHoverProvider";

class DeepCodeAnalyzer implements DeepCode.AnalyzerInterface {
  private SEVERITIES: {
    [key: number]: { name: vscode.DiagnosticSeverity; show: boolean };
  };
  private analysisProgressValue: number = 1; // default value for progress to make it visible from start
  private progress = vscode.window.withProgress;
  private analysisInProgress: boolean = false;
  private issueHoverProvider: vscode.Disposable | undefined;
  private ignoreActionsProvider: vscode.Disposable | undefined;
  private analysisQueueCount: number = 0;
  private issuesMarkersdecorationType:
    | vscode.TextEditorDecorationType
    | undefined;
  public deepcodeReview: vscode.DiagnosticCollection | undefined;
  public analysisResultsCollection: DeepCode.AnalysisResultsCollectionInterface;
  public constructor() {
    this.SEVERITIES = createDeepCodeSeveritiesMap();
    this.deepcodeReview = vscode.languages.createDiagnosticCollection(
      DEEPCODE_NAME
    );

    this.analysisResultsCollection = {};
    this.ignoreActionsProvider = new DisposableCodeActionsProvider(
      this.deepcodeReview,
      {
        findSuggestionId: extractSuggestionIdFromSuggestionsMap(
          this.analysisResultsCollection
        )
      }
    );
    this.issueHoverProvider = new DisposableHoverProvider(this.deepcodeReview);
  }

  private createIssueDiagnosticInfo({
    issue,
    issuePositions,
    suggestions,
    fileUri
  }: {
    issue: number;
    issuePositions: DeepCode.IssuePositionsInterface;
    suggestions: DeepCode.AnalysisSuggestionsInterface;
    fileUri: vscode.Uri;
  }): vscode.Diagnostic {
    const message: string = suggestions[issue].message;
    return {
      code: "",
      message,
      range: createIssueCorrectRange(issuePositions),
      severity: this.SEVERITIES[suggestions[issue].severity].name,
      source: DEEPCODE_NAME,
      //issues markers can be in issuesPositions as prop 'markers',
      ...(issuePositions.markers && {
        relatedInformation: createIssueRelatedInformation({
          markersList: issuePositions.markers,
          fileUri,
          message
        })
      })
    };
  }

  private createIssuesList(
    fileIssuesList: DeepCode.AnalysisResultsFileResultsInterface,
    suggestions: DeepCode.AnalysisSuggestionsInterface,
    fileUri: vscode.Uri
  ): vscode.Diagnostic[] {
    const issuesList: vscode.Diagnostic[] = [];
    for (const issue in fileIssuesList) {
      if (!this.SEVERITIES[suggestions[issue].severity].show) {
        continue;
      }
      for (const issuePositions of fileIssuesList[issue]) {
        issuesList.push(
          this.createIssueDiagnosticInfo({
            issue: +issue,
            issuePositions,
            suggestions,
            fileUri
          })
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

  public setIssuesMarkersDecoration(
    editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
  ): void {
    if (
      editor &&
      this.deepcodeReview &&
      this.deepcodeReview.has(editor.document.uri)
    ) {
      this.clearPrevIssuesMarkersDecoration();
      this.issuesMarkersdecorationType = vscode.window.createTextEditorDecorationType(
        ISSUES_MARKERS_DECORATION_TYPE
      );
      const issuesMarkersDecorationsOptions = createIssuesMarkersDecorationOptions(
        this.deepcodeReview.get(editor.document.uri)
      );
      editor.setDecorations(
        this.issuesMarkersdecorationType,
        issuesMarkersDecorationsOptions
      );
    }
  }

  public async createReviewResults(): Promise<void> {
    if (!this.deepcodeReview) {
      return;
    }
    this.deepcodeReview.clear();

    for (const analysisResultPath in this.analysisResultsCollection) {
      const { files, suggestions } = this.analysisResultsCollection[
        analysisResultPath
      ];
      for (const filePath in files) {
        const fileUri = vscode.Uri.file(`${analysisResultPath}${filePath}`);
        if (!fileUri) {
          return;
        }
        const fileIssuesList = files[filePath];
        const issues = this.createIssuesList(
          fileIssuesList,
          suggestions,
          fileUri
        );
        this.deepcodeReview.set(fileUri, [...issues]);
      }
    }
    this.setIssuesMarkersDecoration();
  }

  public async configureIssuesDisplayBySeverity(
    severity: number,
    hide: boolean
  ): Promise<void> {
    this.SEVERITIES[severity].show = !hide;
    if (Object.keys(this.analysisResultsCollection).length) {
      await this.createReviewResults();
    }
  }

  public async updateReviewResultsPositions(
    extension: DeepCode.ExtensionInterface,
    updatedFile: DeepCode.openedTextEditorType
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
      const fileIssuesList: DeepCode.AnalysisResultsFileResultsInterface = await updateFileReviewResultsPositions(
        this.analysisResultsCollection,
        updatedFile
      );
      this.analysisResultsCollection[updatedFile.workspace].files[
        updatedFile.filePathInWorkspace
      ] = { ...fileIssuesList };
      if (this.deepcodeReview) {
        const issues = this.createIssuesList(
          fileIssuesList,
          this.analysisResultsCollection[updatedFile.workspace].suggestions,
          vscode.Uri.file(updatedFile.fullPath)
        );
        this.deepcodeReview.set(vscode.Uri.file(updatedFile.fullPath), [
          ...issues
        ]);
        this.setIssuesMarkersDecoration();
      }
    } catch (err) {
      extension.errorHandler.sendErrorToServer(extension, err, {
        errorDetails: {
          message: errorsLogs.updateReviewPositions,
          bundleId: extension.remoteBundles[updatedFile.workspace],
          data: {
            [updatedFile.filePathInWorkspace]: updatedFile.contentChanges
          }
        }
      });
    }
  }

  private async requestAnalysisFromServer(
    extension: DeepCode.ExtensionInterface,
    bundleId: string
  ): Promise<any> {
    const analyzer = this;
    let attemptsIfFailedStatus = 2;

    async function fetchAnalysisResults() {
      try {
        const analysisResponse = await http.getAnalysis(extension.token, bundleId);
        const currentProgress = createDeepCodeProgress(analysisResponse.progress);

        analyzer.analysisProgressValue =
          analyzer.analysisProgressValue < currentProgress
            ? currentProgress
            : analyzer.analysisProgressValue;
        if (analysisResponse.status === ANALYSIS_STATUS.failed) {
          attemptsIfFailedStatus--;
          return !attemptsIfFailedStatus
            ? { success: false }
            : await httpDelay(fetchAnalysisResults);
        }
        if (analysisResponse.status !== ANALYSIS_STATUS.done) {
          return await httpDelay(fetchAnalysisResults);
        }
        return { ...analysisResponse.analysisResults, success: true };

      } catch (err) {
        extension.errorHandler.processError(extension, err, {
          errorDetails: {
            message: errorsLogs.failedAnalysis,
            bundleId
          }
        });
        return { success: false };
      }
    }
    return await fetchAnalysisResults();
  }

  private async performAnalysis(
    extension: DeepCode.ExtensionInterface | any,
    workspacePath: string
  ): Promise<DeepCode.AnalysisResultsInterface | { success: boolean }> {
    const { bundleId } = await extension.remoteBundles[workspacePath];
    if (!bundleId) {
      return {
        success: false
      };
    }
    const analysisResults: DeepCode.AnalysisResultsInterface = await this.requestAnalysisFromServer(
      extension,
      bundleId
    );

    if (analysisResults.success) {
      this.analysisResultsCollection[workspacePath] = {
        ...analysisResults
      };
    }
    return analysisResults;
  }

  private async reviewWithProgress(
    path: string,
    vscodeProgress: vscode.Progress<{ increment: number }>,
    extension: DeepCode.ExtensionInterface
  ): Promise<void> {
    if (!extension.remoteBundles[path]) {
      return;
    }
    const missingFiles = extension.remoteBundles[path].missingFiles;
    if (missingFiles && Array.isArray(missingFiles) && missingFiles.length) {
      return;
    }
    const analysisResult = await this.performAnalysis(extension, path);
    if (!analysisResult.success) {
      await this.processFailedReviewCodeResults(extension, path);
    }
    vscodeProgress.report({ increment: this.analysisProgressValue });
  }

  public async reviewCode(
    extension: DeepCode.ExtensionInterface,
    workspacePath: string = ""
  ): Promise<void> {
    const self = this || extension.analyzer;
    const hashesBundlesAreEmpty = extension.workspacesPaths.every(path =>
      extension.checkIfHashesBundlesIsEmpty(path)
    );
    const remoteBundlesAreEmpty = extension.checkIfRemoteBundlesIsEmpty();
    if (remoteBundlesAreEmpty || hashesBundlesAreEmpty) {
      if (self.deepcodeReview) {
        self.deepcodeReview.clear();
        self.analysisResultsCollection = {};
      }
      return;
    }

    if (self.analysisQueueCount === 0) {
      self.analysisQueueCount++;
    }
    // analysis is performed with progress bar
    if (!self.analysisInProgress) {
      self.analysisInProgress = true;
      await self.progress(
        {
          location: vscode.ProgressLocation.Notification,
          title: deepCodeMessages.analysisProgress.msg,
          cancellable: false
        },
        async function progressCallback(vscodeProgress, token) {
          if (self.analysisQueueCount > 0) {
            self.analysisQueueCount--;
          }

          vscodeProgress.report({ increment: self.analysisProgressValue });
          if (!workspacePath) {
            for await (const path of extension.workspacesPaths) {
              await self.reviewWithProgress(path, vscodeProgress, extension);
            }
          } else {
            await self.reviewWithProgress(
              workspacePath,
              vscodeProgress,
              extension
            );
          }
          if (self.analysisQueueCount > 0) {
            await progressCallback(vscodeProgress, token);
          } else {
            self.analysisInProgress = false;
          }
        }
      );
    }
    await self.createReviewResults();
  }

  // Analysis error handle
  private async processFailedReviewCodeResults(
    extension: DeepCode.ExtensionInterface,
    path: string
  ): Promise<void> {
    const { bundleId } = extension.remoteBundles[path];
    extension.errorHandler.sendErrorToServer(extension, new Error(), {
      errorDetails: {
        message: errorsLogs.failedStatusOfAnalysis,
        bundleId
      }
    });
    const workspace = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders.find(folder => {
          return folder.uri.fsPath === path;
        })
      : { name: "" };
    const workspaceName = workspace ? workspace.name : "";
    const {
      msg: analysisErrorMsg,
      button: analysisErrorBtn
    } = deepCodeMessages.codeReviewFailed;
    const analysisErrorButton:
      | string
      | undefined = await vscode.window.showErrorMessage(
      analysisErrorMsg(workspaceName),
      analysisErrorBtn
    );
    if (analysisErrorButton === analysisErrorBtn) {
      // if analysis status === FAILED,
      // we create new bundle, send it, check it and trigger new review
      await extension.updateHashesBundles(path);
      await extension.performBundlesActions(path);
      await this.reviewCode(extension, path);
    }
  }

  public async removeReviewResults(workspacePath: string): Promise<void> {
    await delete this.analysisResultsCollection[workspacePath];
    await this.createReviewResults();
  }
}

export default DeepCodeAnalyzer;
