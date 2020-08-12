import * as vscode from "vscode";
import http from "../../http/requests";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IQueueAnalysisCheckResult } from "@deepcode/tsc";
// import { window, ProgressLocation, Progress } from "vscode";
// import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { checkIfBundleIsEmpty } from "../../utils/bundlesUtils";
import { createListOfDirFiles } from "../../utils/packageUtils";
import { BUNDLE_EVENTS } from "../../constants/events";
// import { errorsLogs } from "../../messages/errorsServerLogMessages";
import LoginModule from "../../lib/modules/LoginModule";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_ANALYSIS_STATUS, DEEPCODE_CONTEXT } from "../../constants/views";

abstract class BundlesModule extends LoginModule
  implements DeepCode.BundlesModuleInterface {
  private rootPath = "";

  private throttledProgress = 0;

  files: string[] = [];
  serviceAI = http.getServiceAI();

  constructor() {
    super();

    this.onBuildBundleProgress = this.onBuildBundleProgress.bind(this);
    this.onBuildBundleFinish = this.onBuildBundleFinish.bind(this);
    this.onUploadBundleProgress = this.onUploadBundleProgress.bind(this);
    this.onUploadBundleFinish = this.onUploadBundleFinish.bind(this);
    this.onAnalyseProgress = this.onAnalyseProgress.bind(this);
    this.onAnalyseFinish = this.onAnalyseFinish.bind(this);
    this.onError = this.onError.bind(this);

    this.serviceAI.on(BUNDLE_EVENTS.error, this.onError);
  }

  updateStatus(status: string, progress?: number) {
    this.analysisStatus = status;
    if (progress) this.analysisProgress = progress;
    this.refreshViews();
  }

  onCollectBundleProgress(value: number) {
    // Avoid refreshing context/views too often:
    // https://github.com/Microsoft/vscode/issues/68424
    if (value < this.throttledProgress + 0.1) return;
    this.throttledProgress = value;
    console.log(`COLLECTING BUNDLE PROGRESS - ${value}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.COLLECTING, value);
  }

  onBuildBundleProgress(processed: number, total: number) {
    console.log(`BUILD BUNDLE PROGRESS - ${processed}/${total}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.HASHING, processed/total);
  }

  onBuildBundleFinish() {
    console.log("BUILD BUNDLE FINISH");
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.HASHING, 1);
  }

  onUploadBundleProgress(processed: number, total: number) {
    console.log(`UPLOAD BUNDLE PROGRESS - ${processed}/${total}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.UPLOADING, processed/total);
  }

  onUploadBundleFinish() {
    console.log("UPLOAD BUNDLE FINISH");
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.UPLOADING, 1);
  }

  onAnalyseProgress(analysisResults: IQueueAnalysisCheckResult) {
    console.log("on Analyse Progress");
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.ANALYZING, 0.5);
  }

  onAnalyseFinish(analysisResults: IQueueAnalysisCheckResult) {
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.ANALYZING, 1);
    setContext(DEEPCODE_CONTEXT.COMPLETED, true);
    type ResultFiles = {
      [filePath: string]: DeepCode.AnalysisResultsFileResultsInterface;
    };
    const resultFiles = (
      analysisResults.analysisResults.files as unknown as ResultFiles
    );
    const result = ({
      files: { ...resultFiles },
      suggestions: analysisResults.analysisResults
        .suggestions as DeepCode.AnalysisSuggestionsInterface,
      success: true
    } as unknown) as DeepCode.AnalysisResultsCollectionInterface;
    console.log("Analysis Result is ready with results --> ", analysisResults);

    const analysedFiles: ResultFiles = {};

    for (let filePath in result.files) {
      const path = filePath.replace(this.rootPath, '');
      // @ts-ignore
      analysedFiles[path] = result.files[filePath];
    }

    result.files = analysedFiles as unknown as DeepCode.AnalysisResultsInterface;
    this.analyzer.updateAnalysisResultsCollection(result, this.rootPath);

    return Promise.resolve();
  }

  onError(error: Error) {
    setContext(DEEPCODE_CONTEXT.COMPLETED, false);
    setContext(DEEPCODE_CONTEXT.ERROR, true);
    this.processError(error);
  }

  // public async askUploadApproval(): Promise<void> {
  //   const { uploadApproval } = deepCodeMessages;
  //   let pressedButton: string | undefined;
    
  //   pressedButton = await vscode.window.showInformationMessage(uploadApproval.msg(this.termsConditionsUrl), uploadApproval.workspace, uploadApproval.global);
  //   if (pressedButton) {
  //     await this.approveUpload(pressedButton === uploadApproval.global);
  //   }
  // }

  // processing workspaces
  public updateCurrentWorkspacePath(newWorkspacePath: string): void {
    this.currentWorkspacePath = newWorkspacePath;
  }

  public createWorkspacesList(workspaces: readonly vscode.WorkspaceFolder[]): void {
    for (const folder of workspaces) {
      this.workspacesPaths.push(folder.uri.fsPath);
    }
  }

  public changeWorkspaceList(
    workspacePath: string,
    deleteFlag: boolean = false
  ): void {
    // by default paths are added
    if (deleteFlag) {
      this.workspacesPaths = this.workspacesPaths.filter(
        path => path !== workspacePath
      );
      return;
    }
    this.workspacesPaths.push(workspacePath);
  }

  // procesing filter list of files, acceptable for server
  public async createFilesFilterList(): Promise<void> {
    this.serverFilesFilterList = await http.getFilters(this.baseURL, this.token);
  }

  public async performBundlesActions(path: string): Promise<void> {
    setContext(DEEPCODE_CONTEXT.COMPLETED, false);
    
    if (!Object.keys(this.serverFilesFilterList).length) {
      await this.createFilesFilterList();
      this.filesWatcher.activate(this);

      if (!Object.keys(this.serverFilesFilterList).length) {
        return;
      }
    }

    if (!this.token || !this.uploadApproved) {
      this.startExtension();
      return;
    }

    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.HASHING, 0);
    this.files = await this.startCollectingFiles(path, this.serverFilesFilterList);
    
    // const progressOptions = {
    //   location: ProgressLocation.Notification,
    //   title: deepCodeMessages.analysisProgress.msg,
    //   cancellable: false
    // };

    // const countStep = (processed: number, total: number): number => {
    //   const lastPhaseProgress = 33;
    //   const currentProgress = (processed / total * 33) + lastPhaseProgress;
    //   return currentProgress;
    // };

    // window.withProgress(progressOptions, async progress => {
    this.serviceAI.on(BUNDLE_EVENTS.buildBundleProgress, (processed: number, total: number) => {
      this.onBuildBundleProgress(processed, total);
    });

    this.serviceAI.on(BUNDLE_EVENTS.buildBundleFinish, () => {
      // progress.report({ increment: 33 });
      this.onBuildBundleFinish();
    });

    this.serviceAI.on(BUNDLE_EVENTS.uploadBundleProgress, (processed: number, total: number) => {
      // const currentProgress = countStep(processed, total);
      this.onUploadBundleProgress(processed, total);
      // progress.report({ increment: currentProgress });
    });

    this.serviceAI.on(BUNDLE_EVENTS.uploadFilesFinish, () => {
      this.onUploadBundleFinish();
      // progress.report({ increment: 80 });
    });

    this.serviceAI.on(BUNDLE_EVENTS.analyseProgress, (analysisResults: IQueueAnalysisCheckResult) => {
      // progress.report({ increment: 90 });
      this.onAnalyseProgress(analysisResults);
    });

    this.serviceAI.on(
      BUNDLE_EVENTS.analyseFinish,
      (analysisResults: IQueueAnalysisCheckResult) => {
        // progress.report({ increment: 100 });
        this.serviceAI.removeListeners();
        this.onAnalyseFinish(analysisResults);
      }
    );

    this.serviceAI.on(BUNDLE_EVENTS.error, (error: Error) => {
      // progress.report({ increment: 100 });
      this.serviceAI.removeListeners();
      this.onError(error);
    });

    await http.analyse(this.baseURL, this.token, path, this.files).catch(err => {});
    // });
  }

  private async startCollectingFiles(
    folderPath: string,
    serverFilesFilterList: DeepCode.AllowedServerFilterListInterface
  ): Promise<string[]> {
    // const progressOptions = {
    //   location: ProgressLocation.Notification,
    //   title: deepCodeMessages.fileLoadingProgress.msg,
    //   cancellable: false
    // };
  
    // const {
    //   bundle: finalBundle,
    //   progress: finalProgress
    // } = await window.withProgress(progressOptions, async (progress) => {
    //   // Get a directory size overview for progress reporting
    //   progress.report({ increment: 1 });
  
      // Filter, read and hash all files
    const bundle = await createListOfDirFiles({
      serverFilesFilterList,
      path: folderPath,
      progress: {
        onProgress: this.onCollectBundleProgress.bind(this),
      }
    });
      // progress.report({ increment: 100 });
      // return res;
    // });
  
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.COLLECTING, 1);
    console.warn(`Processed ${bundle.length} files`);
  
    return bundle;
  }

  private async createSingleHashBundle(
    path: string
  ): Promise<DeepCode.BundlesInterface> {
    this.rootPath = path;

    // convert string[] to BundleInterface
    const filesBundle: { [key: string]: string } = {};
    let resultBundle: { [key: string]: string } = this.files.reduce(
      (resultBundle, filePath) => {
        resultBundle[filePath] = filePath;
        return resultBundle;
      },
      filesBundle
    );
    return resultBundle;
  }

  public async updateHashesBundles(
    workspacePath: string = "",
    deleteFlag: boolean = false
  ): Promise<void> {
    if (!workspacePath) {
      for await (const path of this.workspacesPaths) {
        this.hashesBundles[path] = await this.createSingleHashBundle(path);
      }
      return;
    }
    if (deleteFlag) {
      delete this.hashesBundles[workspacePath];
      return;
    }
    this.hashesBundles[workspacePath] = await this.createSingleHashBundle(
      workspacePath
    );
  }

  public checkIfHashesBundlesIsEmpty(bundlePath?: string): boolean {
    return checkIfBundleIsEmpty(this.hashesBundles, bundlePath);
  }

  public checkIfRemoteBundlesIsEmpty(bundlePath?: string): boolean {
    return checkIfBundleIsEmpty(this.remoteBundles, bundlePath);
  }

  // processing remote server bundles
  public async updateExtensionRemoteBundles(
    workspacePath: string,
    bundle: DeepCode.RemoteBundleInterface | null = null
  ): Promise<void> {
    if (bundle) {
      this.remoteBundles[workspacePath] = { ...bundle };
      return;
    }
    delete this.remoteBundles[workspacePath];
  }

  public async startAnalysis(): Promise<void> {
    try {
      const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || !workspaceFolders.length) {
        return;
      }

      this.createWorkspacesList(workspaceFolders);

      if (this.workspacesPaths.length) {
        this.updateCurrentWorkspacePath(this.workspacesPaths[0]);

        await this.updateHashesBundles();
        for await (const path of this.workspacesPaths) {
          await this.performBundlesActions(path);
        }
      }
    } catch(err) {
      await this.processError(err);
    }
  }
}

export default BundlesModule;
