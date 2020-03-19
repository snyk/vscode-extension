import * as vscode from "vscode";
import http from "../../http/requests";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IQueueAnalysisCheckResult } from "@deepcode/tsc";
import { window, ProgressLocation, Progress } from "vscode";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import { processServerFilesFilterList } from "../../utils/filesUtils";
import { checkIfBundleIsEmpty } from "../../utils/bundlesUtils";
import { startFilesUpload } from "../../utils/packageUtils";
import { BUNDLE_EVENTS } from "../../constants/events";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import LoginModule from "../../lib/modules/LoginModule";
import { getExtension } from "../../../extension";

class BundlesModule extends LoginModule
  implements DeepCode.BundlesModuleInterface {
  private rootPath = "";

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

    this.serviceAI.on(
      BUNDLE_EVENTS.uploadBundleProgress,
      this.onUploadBundleProgress
    );
    this.serviceAI.on(BUNDLE_EVENTS.analyseProgress, this.onAnalyseProgress);
    this.serviceAI.on(BUNDLE_EVENTS.error, this.onError);
  }

  onBuildBundleProgress() {
    console.warn("BUILD BUNDLE PROGRESS event");
  }

  onBuildBundleFinish() {
    console.warn("BUILD BUNDLE FINISH event");
  }

  onUploadBundleProgress(processed: number, total: number) {
    console.warn("on UploadBundle Progress");
  }

  onUploadBundleFinish() {
    console.warn("UPLOAD BUNDLE FINISH event");
  }

  onAnalyseProgress(analysisResults: IQueueAnalysisCheckResult) {
    console.warn("on Analyse Progress");
  }

  onAnalyseFinish(analysisResults: IQueueAnalysisCheckResult) {
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
    console.error("Analysis Result is ready");

    this.analyzer.updateAnalysisResultsCollection(result);

    return Promise.resolve();
  }

  onError(error: Error) {
    console.error(error);
    return Promise.reject(error);
  }

  // processing workspaces
  public updateCurrentWorkspacePath(newWorkspacePath: string): void {
    this.currentWorkspacePath = newWorkspacePath;
  }

  public createWorkspacesList(workspaces: vscode.WorkspaceFolder[]): void {
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
    try {
      const serverFilesFilters = await http.getFilters(this.token);
      const { extensions, configFiles } = serverFilesFilters;
      const processedFilters = processServerFilesFilterList({
        extensions,
        configFiles
      });
      this.serverFilesFilterList = { ...processedFilters };
    } catch (err) {
      this.errorHandler.processError(this, err, {
        errorDetails: {
          message: errorsLogs.filtersFiles
        }
      });
    }
  }

  public async performBundlesActions(path: string): Promise<void> {
    if (!Object.keys(this.serverFilesFilterList).length) {
      return;
    }

    this.files = await startFilesUpload(path, this.serverFilesFilterList);
    const files: string[] = this.getFiles(this.files, path);

    const progressOptions = {
      location: ProgressLocation.Notification,
      title: deepCodeMessages.fileLoadingProgress.msg,
      cancellable: false
    };

    window.withProgress(progressOptions, async progress => {
      this.serviceAI.on(BUNDLE_EVENTS.buildBundleFinish, () => {
        progress.report({ increment: 33 });
        this.onBuildBundleFinish();
      });
      this.serviceAI.on(BUNDLE_EVENTS.uploadFilesFinish, () => {
        progress.report({ increment: 66 });
        this.onUploadBundleFinish();
      });
      this.serviceAI.on(
        BUNDLE_EVENTS.analyseFinish,
        (analysisResults: IQueueAnalysisCheckResult) => {
          progress.report({ increment: 100 });
          this.onAnalyseFinish(analysisResults);
        }
      );
      this.serviceAI.on(BUNDLE_EVENTS.error, () => {
        progress.report({ increment: 100 });
        this.onError(new Error("analyse process faild"));
      });

      try {
        await http.analyse(files, this.token);
      } catch(error) {
        console.log(error);
      }
    });
  }

  // TODO: REMOVE or just update?
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

  private getFiles(bundleForServer: string[], path: string) {
    const files = bundleForServer.map(file => path + file);
    return files;
  }

  // TODO: REMOVE
  // private async processBundleFromServer(
  //   serverBundle: DeepCode.RemoteBundleInterface,
  //   workspacePath: string
  // ): Promise<void> {
  //   await this.updateExtensionRemoteBundles(workspacePath, serverBundle);
  //   // if server bundles has missing files - upload them to server
  //   const { missingFiles } = this.remoteBundles[workspacePath];
  //   if (missingFiles && missingFiles.length) {
  //     await this.uploadMissingFilesToServerBundle(workspacePath);
  //   }
  // }
  // // processing missing files in bundles
  // private async createMissingFilesPayload(
  //   missingFiles: Array<string> | undefined,
  //   workspacePath: string
  // ): Promise<Array<DeepCode.PayloadMissingFileInterface>> {
  //   const path = this.workspacesPaths.find(path => path === workspacePath);
  //   if (Array.isArray(missingFiles) && path) {
  //     return await createMissingFilesPayloadUtil([...missingFiles], path);
  //   }
  //   return [];
  // }

  // TODO: REMOVE http.uploadFiles
  // public async uploadMissingFilesToServerBundle(
  //   workspacePath: string,
  //   chunkedPayload: DeepCode.PayloadMissingFileInterface[] = [],
  //   isDelay: boolean = false
  // ): Promise<void> {
  //   const bundleId = this.remoteBundles[workspacePath].bundleId || "";
  //   let payload: Array<DeepCode.PayloadMissingFileInterface> = [];

  //   const sendUploadRequest = async (chunkPayload: any): Promise<void> => {
  //     try {
  //       const uploadFilesReq = async () =>
  //         await http.uploadFiles(this.token, bundleId, chunkPayload);

  //       // Wait/retry later (invoked below for bigPayload case)
  //       const uploadResponse = isDelay
  //         ? await httpDelay(uploadFilesReq)
  //         : await uploadFilesReq();
  //     } catch (err) {
  //       if (err.statusCode === statusCodes.bigPayload) {
  //         const isDelay = true;

  //         // Assume temporary Retry-After and retry
  //         // TODO if the assumption is incorrect, we'll loop indefinitely on oversized items
  //         // See also https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
  //         await this.uploadMissingFilesToServerBundle(
  //           workspacePath,
  //           chunkPayload,
  //           isDelay
  //         );
  //       } else {
  //         this.errorHandler.processError(this, err, {
  //           errorDetails: {
  //             message: errorsLogs.uploadFiles,
  //             bundleId,
  //             data: {
  //               missingFiles: chunkPayload
  //             }
  //           }
  //         });
  //       }
  //     }
  //   };

  //   if (!chunkedPayload.length) {
  //     const { missingFiles } = this.remoteBundles[workspacePath];
  //     payload = await this.createMissingFilesPayload(
  //       missingFiles,
  //       workspacePath
  //     );
  //     if (!payload.length) {
  //       return;
  //     }
  //   } else {
  //     payload = chunkedPayload;
  //   }
  //   const processedPayload = processPayloadSize(payload);
  //   if (processedPayload.chunks) {
  //     for await (const chunkPayload of processedPayload.payload) {
  //       await sendUploadRequest(chunkPayload);
  //     }
  //   } else {
  //     await sendUploadRequest(processedPayload.payload);
  //   }
  // }

  // check bundle server status
  // public async checkBundleOnServer(
  //   workspacePath: string,
  //   attempts: number = ATTEMPTS_AMMOUNT,
  //   isDelay = false
  // ): Promise<void> {
  //   if (!this.remoteBundles[workspacePath]) {
  //     return;
  //   }

  //   const bundleId = this.remoteBundles[workspacePath].bundleId || "";
  //   try {
  //     if (!attempts) {
  //       throw new Error(EXPIRED_REQUEST);
  //     }
  //     // TODO: remove http.checkBundle
  //     const checkBundleReq = async () =>
  //       await http.checkBundle(this.token, bundleId);
  //     const latestServerBundle: DeepCode.RemoteBundleInterface = isDelay
  //       ? await httpDelay(checkBundleReq)
  //       : await checkBundleReq();

  //     await this.processBundleFromServer(latestServerBundle, workspacePath);

  //     const { missingFiles } = this.remoteBundles[workspacePath];
  //     if (missingFiles && missingFiles.length) {
  //       const isDelay = true;
  //       await this.checkBundleOnServer(workspacePath, attempts--, isDelay);
  //     }
  //   } catch (err) {
  //     let message = errorsLogs.checkBundle;
  //     if (err.message === EXPIRED_REQUEST) {
  //       message = errorsLogs.checkBundleAfterAttempts(ATTEMPTS_AMMOUNT);
  //     }
  //     this.errorHandler.processError(this, err, {
  //       workspacePath,
  //       errorDetails: {
  //         message,
  //         bundleId
  //       }
  //     });
  //   }
  // }
  // extending bundles

  // TODO: REMOVE (?)
  // public async extendWorkspaceHashesBundle(
  //   updatedFiles: Array<{
  //     [key: string]: string;
  //   }>,
  //   workspacePath: string
  // ): Promise<void> {
  //   const updatedHashBundle = await extendLocalHashBundle(
  //     updatedFiles,
  //     this.hashesBundles[workspacePath]
  //   );
  //   this.hashesBundles[workspacePath] = {
  //     ...updatedHashBundle
  //   };
  // }

  // TODO: REMOVE  -  EXTEND BUNDLE (???  => calling http.extendBundle)
  // public async extendBundleOnServer(
  //   updatedFiles: Array<{
  //     [key: string]: string;
  //   }>,
  //   workspacePath: string
  // ): Promise<void> {
  //   const remoteBundleDoesNotExists: boolean = !this.remoteBundles[
  //     workspacePath
  //   ];
  //   const hashesBundleIsEmpty: boolean = this.checkIfHashesBundlesIsEmpty(
  //     workspacePath
  //   );
  //   if (remoteBundleDoesNotExists || hashesBundleIsEmpty) {
  //     return;
  //   }

  //   const extendBatchBody: DeepCode.RemoteExtendBundleInterface = {
  //     files: {},
  //     removedFiles: []
  //   };
  //   const { created, modified, deleted } = FILE_CURRENT_STATUS;
  //   for await (const updatedFile of updatedFiles) {
  //     const { status, filePath = "", fileHash = "" } = updatedFile;
  //     if (status === modified || status === created) {
  //       extendBatchBody.files = {
  //         ...extendBatchBody.files,
  //         [filePath]: fileHash
  //       };
  //     }
  //     if (status === deleted && extendBatchBody.removedFiles) {
  //       extendBatchBody.removedFiles.push(filePath);
  //     }
  //   }

  //   const bundleId = this.remoteBundles[workspacePath].bundleId || "";
  //   try {
  //     const extendedServerBundle = await http.extendBundle(
  //       this.token,
  //       bundleId,
  //       extendBatchBody
  //     );
  //     await this.processBundleFromServer(extendedServerBundle, workspacePath);
  //   } catch (err) {
  //     this.errorHandler.processError(this, err, {
  //       workspacePath,
  //       removedBundle: !!Object.keys(this.remoteBundles).length,
  //       errorDetails: {
  //         message: errorsLogs.extendBundle,
  //         bundleId,
  //         data: {
  //           ...extendBatchBody
  //         }
  //       }
  //     });
  //   }
  // }
}

export default BundlesModule;
