import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import http from "../../http/requests";
import { ping } from "../../utils/httpUtils";
import {
  updateFileReviewResultsPositions,
  findIssueWithRange,
  createDeepCodeProgress,
  createIssueCorrectRange
} from "../../utils/analysisUtils";
import { DEEPCODE_NAME } from "../../constants/general";
import {
  ANALYSIS_STATUS,
  DEEPCODE_SEVERITIES,
  IGNORE_TIP_FOR_USER,
  ISSUES_MARKERS_DECORATION_STYLE
} from "../../constants/analysis";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { errorsLogs } from "../../messages/errorsServerLogMessages";

import { IgnoreIssuesActionProvider } from "./DeepCodeIssuesActionsProviders";

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
    const { information, error, warning } = DEEPCODE_SEVERITIES;
    this.SEVERITIES = {
      [information]: {
        name: vscode.DiagnosticSeverity.Information,
        show: true
      },
      [warning]: { name: vscode.DiagnosticSeverity.Warning, show: true },
      [error]: { name: vscode.DiagnosticSeverity.Error, show: true }
    };

    this.deepcodeReview = vscode.languages.createDiagnosticCollection(
      DEEPCODE_NAME
    );

    this.analysisResultsCollection = {};
    this.createHoverTipsProviderForIssues();
    this.createIgnoreIssueActions();
  }

  private createHoverTipsProviderForIssues() {
    // create hover provider for instructions tips
    if (this.issueHoverProvider) {
      this.issueHoverProvider.dispose();
    }
    const reviewList = this.deepcodeReview;
    this.issueHoverProvider = vscode.languages.registerHoverProvider(
      { scheme: "file", language: "*" },
      {
        provideHover(document, position, token) {
          if (!reviewList || !reviewList.has(document.uri)) {
            return;
          }
          const currentFileReviewIssues = reviewList.get(document.uri);
          if (findIssueWithRange(position, currentFileReviewIssues)) {
            return new vscode.Hover(IGNORE_TIP_FOR_USER);
          }
        }
      }
    );
  }

  private createIgnoreIssueActions() {
    if (this.ignoreActionsProvider) {
      this.ignoreActionsProvider.dispose();
    }
    this.ignoreActionsProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "*" },
      new IgnoreIssuesActionProvider(this.deepcodeReview),
      {
        providedCodeActionKinds:
          IgnoreIssuesActionProvider.providedCodeActionKinds
      }
    );
  }

  private createIssuesList(
    fileIssuesList: DeepCode.AnalysisResultsFileResultsInterface,
    suggestions: DeepCode.analysisSuggestionsType,
    fileUri: vscode.Uri
  ): vscode.Diagnostic[] {
    const issuesList: vscode.Diagnostic[] = [];
    for (const issue in fileIssuesList) {
      if (!this.SEVERITIES[suggestions[issue].severity].show) {
        continue;
      }
      const message = suggestions[issue].message;
      for (const issuePosition of fileIssuesList[issue]) {
        const issueDiagnostics = {
          code: "",
          message,
          range: createIssueCorrectRange(issuePosition),
          severity: this.SEVERITIES[suggestions[issue].severity].name,
          source: DEEPCODE_NAME
          // TODO: set issue markers into related information, like below
          // relatedInformation: [
          //   new vscode.DiagnosticRelatedInformation(
          //     new vscode.Location(
          //       fileUri,
          //       new vscode.Range(
          //         new vscode.Position(84, 10),
          //         new vscode.Position(84, 22)
          //       )
          //     ),
          //     "Hint for issue(this string can be changed)"
          //   ),
          //   new vscode.DiagnosticRelatedInformation(
          //     new vscode.Location(
          //       fileUri,
          //       new vscode.Range(
          //         new vscode.Position(85, 10),
          //         new vscode.Position(85, 22)
          //       )
          //     ),
          //     "Hint for issue2(this string can be changed)"
          //   )
          // ]
        };
        issuesList.push(issueDiagnostics);
      }
    }
    return issuesList;
  }

  // TODO when analysis results endpoint will send markers for issue, highlight markers and update on changing editors
  public setIssuesMarkersDecoration(
    editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
  ): void {
    if (
      editor &&
      this.deepcodeReview &&
      this.deepcodeReview.has(editor.document.uri)
    ) {
      // TODO: for real markers =>find issues for current editor => get markers positions of issue and use it for decoration
      // const currentFileReviewIssues = this.deepcodeReview.get(
      //   editor.document.uri
      // );
      this.clearPrevIssuesMarkersDecoration();
      this.issuesMarkersdecorationType = vscode.window.createTextEditorDecorationType(
        ISSUES_MARKERS_DECORATION_STYLE
      );
      // test hardcoded markers
      editor.setDecorations(this.issuesMarkersdecorationType, [
        // TODO: here should be placed positions of issue markers, like example below
        {
          range: new vscode.Range(
            new vscode.Position(84, 10),
            new vscode.Position(84, 22)
          ),
          hoverMessage: "Hint for issue(Deepcode)(Test string)"
        },
        {
          range: new vscode.Range(
            new vscode.Position(85, 10),
            new vscode.Position(85, 22)
          ),
          hoverMessage: "Hint for issue2(Deepcode)(Test string)"
        }
      ]);
    }
  }

  private clearPrevIssuesMarkersDecoration() {
    if (this.issuesMarkersdecorationType) {
      this.issuesMarkersdecorationType.dispose();
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
    // set issues markers decoration
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
          this.analysisResultsCollection[updatedFile.workspace].suggestions,
          vscode.Uri.file(updatedFile.fullPath)
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
        // TODO: remove console
        console.log({ analysisResponse });
        const currentProgress = createDeepCodeProgress(
          analysisResponse.progress
        );
        analyzer.analysisProgressValue =
          analyzer.analysisProgressValue < currentProgress
            ? currentProgress
            : analyzer.analysisProgressValue;
        if (analysisResponse.status === ANALYSIS_STATUS.failed) {
          attemptsIfFailedStatus--;
          return !attemptsIfFailedStatus
            ? { success: false }
            : await ping(fetchAnalysisResults);
        }
        if (analysisResponse.status !== ANALYSIS_STATUS.done) {
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
