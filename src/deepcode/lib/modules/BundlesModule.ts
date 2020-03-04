import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import { IQueueAnalysisCheckResult } from "@deepcode/tsc";
import {
  EXPIRED_REQUEST,
  ATTEMPTS_AMMOUNT,
  statusCodes
} from "../../constants/statusCodes";
import http from "../../http/requests";
import {
  createMissingFilesPayloadUtil,
  createFilesHashesBundle,
  processServerFilesFilterList,
  processPayloadSize,
  scanFileCountFromDirectory,
  createListOfDirFilesHashes
} from "../../utils/filesUtils";
import {
  checkIfBundleIsEmpty,
  extendLocalHashBundle
} from "../../utils/bundlesUtils";
// creating git bundles is disabled, may be used in future
// import {createGitBundle} from '../../utils/gitUtils';
import { createBundleBody, httpDelay } from "../../utils/httpUtils";
import { FILE_CURRENT_STATUS } from "../../constants/filesConstants";
import { BUNDLE_EVENTS } from "../../constants/events";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { deepCodeMessages } from "../../messages/deepCodeMessages";
import LoginModule from "../../lib/modules/LoginModule";
import { ExclusionRule, ExclusionFilter } from "../../utils/ignoreUtils";
import { window, ProgressLocation, Progress } from "vscode";
import { EXCLUDED_NAMES } from "../../constants/filesConstants";

class BundlesModule extends LoginModule
  implements DeepCode.BundlesModuleInterface {
  private rootPath = "";

  constructor() {
    super();

    const serviceAI = http.getServiceAI();

    this.onBuildBundleProgress = this.onBuildBundleProgress.bind(this);
    this.onBuildBundleFinish = this.onBuildBundleFinish.bind(this);
    this.onUploadBundleProgress = this.onUploadBundleProgress.bind(this);
    this.onUploadBundleFinish = this.onUploadBundleFinish.bind(this);
    this.onAnalyseProgress = this.onAnalyseProgress.bind(this);
    this.onAnalyseFinish = this.onAnalyseFinish.bind(this);
    this.onError = this.onError.bind(this);

    serviceAI.on(BUNDLE_EVENTS.buildBundleProgress, this.onBuildBundleProgress);
    serviceAI.on(BUNDLE_EVENTS.buildBundleFinish, this.onBuildBundleFinish);
    serviceAI.on(
      BUNDLE_EVENTS.uploadBundleProgress,
      this.onUploadBundleProgress
    );
    serviceAI.on(BUNDLE_EVENTS.uploadFilesFinish, this.onUploadBundleFinish);
    serviceAI.on(BUNDLE_EVENTS.analyseProgress, this.onAnalyseProgress);
    serviceAI.on(BUNDLE_EVENTS.analyseFinish, this.onAnalyseFinish);
    serviceAI.on(BUNDLE_EVENTS.error, this.onError);
  }

  onBuildBundleProgress() {
    setTimeout(async () => {
      // await CommonUtils.sleep(100);
      // Store.set(STORE_KEYS.composingInProcess, true);
    }, 0);
  }

  onBuildBundleFinish() {
    setTimeout(async () => {
      // await CommonUtils.sleep(100);
      // Store.set(STORE_KEYS.composingInProcess, false);
    }, 0);
  }

  onUploadBundleProgress(processed: number, total: number) {
    setTimeout(async () => {
      // Store.setMany({
      //   [STORE_KEYS.uploadInProgress]: true,
      //   [STORE_KEYS.uploadCompleted]: processed,
      //   [STORE_KEYS.uploadTotal]: total
      // });

      
      const exclusionFilter = new ExclusionFilter();
      const rootExclusionRule = new ExclusionRule();
      rootExclusionRule.addExclusions(EXCLUDED_NAMES, "");
      exclusionFilter.addExclusionRule(rootExclusionRule);

      const {
        bundle: finalBundle,
        progress: finalProgress
      } = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: deepCodeMessages.fileLoadingProgress.msg,
          cancellable: false
        },
        async (progress, token) => {
          // Get a directory size overview for progress reporting
          let count = await scanFileCountFromDirectory(this.rootPath);

          console.warn(`Checking ${count} files...`);
          progress.report({ increment: 1 });
          // Filter, read and hash all files
          const res = await createListOfDirFilesHashes(
            // get the correct value of - 'serverFilesFilterList'
            this.serverFilesFilterList,
            this.rootPath,
            this.rootPath,
            exclusionFilter,
            {
              // progress data
              filesProcessed: 0,
              totalFiles: count,
              percentDone: 0,
              progressWindow: progress
            }
          );
          progress.report({ increment: 100 });
          // console.log('HERE: ====> ', res);
          return res;
        }
      );
      console.warn(`Hashed ${Object.keys(finalBundle).length} files`);
      return finalBundle; // final window result
    }, 0);
  }

  onUploadBundleFinish() {
    setTimeout(async () => {
      // Store.set(STORE_KEYS.uploadInProgress, false);
    }, 0);
  }

  onAnalyseProgress(analysisResults: IQueueAnalysisCheckResult) {
    setTimeout(async () => {
      // const adaptedResults = await Analyser.adaptResults(
      //   analysisResults.analysisResults
      // );
      // Store.set(STORE_KEYS.analysisResults, adaptedResults);
      // Store.set(STORE_KEYS.analysisInProgress, true);
    }, 0);
  }

  onAnalyseFinish(analysisResults: IQueueAnalysisCheckResult) {
    setTimeout(async () => {
      // const adaptedResults = await Analyser.adaptResults(
      //   analysisResults.analysisResults
      // );
      // Store.set(STORE_KEYS.analysisResults, adaptedResults);
      // Store.set(STORE_KEYS.analysisInProgress, false);
    }, 0);
  }

  onError(error: Error) {
    // Logger.log(error);
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
    if (
      !Object.keys(this.serverFilesFilterList).length ||
      !this.checkUploadConfirm(path) ||
      this.checkIfHashesBundlesIsEmpty(path)
    ) {
      return;
    }
    // TODO: Remove next two methods
    // await this.sendRemoteBundleToServer(
    //   path,
    //   await this.createRemoteBundleForServer(path)
    // );
    // await this.checkBundleOnServer(path);

    // FIXME: ANANLYSE starts here
    const files = this.getFiles(
      await this.createRemoteBundleForServer(path),
      path
    );
    await http.analyse(files, this.token);
  }

  // processing bundles of files hashes
  private async createSingleHashBundle(
    path: string
  ): Promise<DeepCode.BundlesInterface> {
    this.rootPath = path;
    return await createFilesHashesBundle(path, this.serverFilesFilterList);
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

  private async createRemoteBundleForServer(
    workspacePath: string
  ): Promise<DeepCode.BundlesInterface> {
    let bundleForServer = this.hashesBundles[workspacePath];
    // GIT REPOS ARE TEMPORARILY DISABLED
    return bundleForServer;
  }

  private getFiles(bundleForServer: { [key: string]: string }, path: string) {
    const files = bundleForServer.repo
      ? (bundleForServer as object)
      : (createBundleBody(bundleForServer).files as object);

    return Object.keys(files).map(file => path + file);
  }

  // TODO: remove CREATE BUNDLE
  // private async sendRemoteBundleToServer(
  //   workspacePath: string,
  //   bundleForServer: {
  //     [key: string]: string;
  //   }
  // ): Promise<void> {
  //   try {
  //     const files = bundleForServer.repo
  //       ? (bundleForServer as object)
  //       : (createBundleBody(bundleForServer).files as object);
  //     const serverBundle = await http.createBundle(this.token, files);

  //     await this.processBundleFromServer(serverBundle, workspacePath);
  //   } catch (err) {
  //     await this.errorHandler.processError(this, err, {
  //       workspacePath,
  //       removedBundle: !!Object.keys(this.remoteBundles).length,
  //       errorDetails: {
  //         message: errorsLogs.createBundle
  //       }
  //     });
  //   }
  // }

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
