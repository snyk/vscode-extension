import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { ping } from "../../utils/httpUtils";
import { updateFileReviewResultsPositions } from "../../utils/analysisUtils";
import { DEEPCODE_NAME } from "../../constants/general";
import { analysisStatus } from "../../constants/analysis";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";

class DeepCodeAnalyzer implements DeepCode.AnalyzerInterface {
  private SEVERITIES: { [key: number]: vscode.DiagnosticSeverity };
  private analysisProgressValue: number = 1; // default value for progress to make it visible from start
  private progress = vscode.window.withProgress;
  private analysisInProgress: boolean = false;
  private analysisQueueCount: number = 0;
  public deepcodeReview: vscode.DiagnosticCollection | undefined;
  public analysisResultsCollection: DeepCode.AnalysisResultsCollectionInterface;
  public constructor() {
    this.SEVERITIES = {
      1: vscode.DiagnosticSeverity.Information,
      2: vscode.DiagnosticSeverity.Warning,
      3: vscode.DiagnosticSeverity.Error
    };

    this.deepcodeReview = vscode.languages.createDiagnosticCollection(
      DEEPCODE_NAME
    );

    this.analysisResultsCollection = {};
  }

  private createVscodeProgress(progress: number): number {
    const progressOffset = 100;
    return Math.round(progress * progressOffset);
  }

  private createCorrectPlacement(item: {
    [key: string]: Array<number>;
  }): { [key: string]: { [key: string]: number } } {
    const rowOffset = 1;
    const createPosition = (i: number): number =>
      i - rowOffset < 0 ? 0 : i - rowOffset;
    return {
      cols: {
        start: createPosition(item.cols[0]),
        end: item.cols[1]
      },
      rows: {
        start: createPosition(item.rows[0]),
        end: createPosition(item.rows[1])
      }
    };
  }

  private createIssueRange(position: {
    [key: string]: { [key: string]: number };
  }) {
    return new vscode.Range(
      new vscode.Position(position.rows.start, position.cols.start),
      new vscode.Position(position.rows.end, position.cols.end)
    );
  }

  private createIssuesList(
    fileIssuesList: DeepCode.AnalysisResultsFileResultsInterface,
    suggestions: DeepCode.analysisSuggestionsType
  ) {
    const issuesList: vscode.Diagnostic[] = [];
    for (const issue in fileIssuesList) {
      const message = suggestions[issue].message;

      for (const issuePosition of fileIssuesList[issue]) {
        issuesList.push({
          code: "",
          message,
          range: this.createIssueRange({
            ...this.createCorrectPlacement(issuePosition)
          }),
          severity: this.SEVERITIES[suggestions[issue].severity],
          source: DEEPCODE_NAME
        });
      }
    }
    return issuesList;
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
        const issues = this.createIssuesList(fileIssuesList, suggestions);
        this.deepcodeReview.set(fileUri, [...issues]);
      }
    }
  }

  public async updateReviewResultsPositions(
    extension: DeepCode.ExtensionInterface,
    updatedFile: DeepCode.openedTextEditorType
  ): Promise<void> {
    try {
      if (
        !this.analysisResultsCollection[updatedFile.workspace] ||
        !this.analysisResultsCollection[updatedFile.workspace].files[
          updatedFile.filePathInWorkspace
        ] ||
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
          this.analysisResultsCollection[updatedFile.workspace].suggestions
        );
        this.deepcodeReview.set(vscode.Uri.file(updatedFile.fullPath), [
          ...issues
        ]);
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
    const endpoint = extension.config.getAnalysisUrl(bundleId);
    async function fetchAnalysisResults() {
      try {
        const analysisResponse: { [key: string]: any } = await http.get(
          endpoint,
          extension.token
        );
        const currentProgress = analyzer.createVscodeProgress(
          analysisResponse.progress
        );
        analyzer.analysisProgressValue =
          analyzer.analysisProgressValue < currentProgress
            ? currentProgress
            : analyzer.analysisProgressValue;
        if (analysisResponse.status === analysisStatus.failed) {
          attemptsIfFailedStatus--;
          return !attemptsIfFailedStatus
            ? { success: false }
            : await ping(fetchAnalysisResults);
        }
        if (analysisResponse.status !== analysisStatus.done) {
          return await ping(fetchAnalysisResults);
        }
        return { ...analysisResponse.analysisResults, success: true };
      } catch (err) {
        extension.errorHandler.processError(extension, err, {
          errorDetails: {
            message: errorsLogs.failedAnalysis,
            endpoint,
            bundleId
          }
        });
        return { success: false };
      }
    }
    return await ping(fetchAnalysisResults);
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
      if (this.deepcodeReview && this.analysisResultsCollection[path]) {
        delete this.analysisResultsCollection[path];
      }
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
    if (!Object.keys(extension.remoteBundles).length) {
      if (self.deepcodeReview) {
        self.deepcodeReview.clear();
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
        endpoint: extension.config.getAnalysisUrl(bundleId),
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
