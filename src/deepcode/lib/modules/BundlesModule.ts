import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import {
  EXPIRED_REQUEST,
  ATTEMPTS_AMMOUNT,
  statusCodes,
  MISSING_CONSENT
} from "../../constants/statusCodes";
import http from "../../http/requests";
import {
  createMissingFilesPayload,
  createFilesHashesBundle,
  processServerFilesFilterList,
  processPayloadSize
} from "../../utils/filesUtils";
// creating git bundles is disabled, may be used in future
// import {createGitBundle} from '../../utils/gitUtils';
import { createBundleBody } from "../../utils/httpUtils";
import { FILE_CURRENT_STATUS } from "../../constants/filesConstants";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import LoginModule from "../../lib/modules/LoginModule";
class BundlesModule extends LoginModule {
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
      const serverFilesFilters = await http.get(
        this.config.filtersUrl,
        this.token
      );
      const { extensions, configFiles } = serverFilesFilters;
      const processedFilters = processServerFilesFilterList({
        extensions,
        configFiles
      });
      this.serverFilesFilterList = { ...processedFilters };
    } catch (err) {
      this.errorHandler.processError(this, err, {
        errorDetails: {
          message: errorsLogs.filtersFiles,
          endpoint: this.config.filtersUrl
        }
      });
    }
  }

  public async performBundlesActions(path: string): Promise<void> {
    if (
      !Object.keys(this.serverFilesFilterList).length ||
      !this.checkUploadConfirm(path)
    ) {
      return;
    }
    await this.sendRemoteBundleToServer(
      path,
      await this.createRemoteBundleForServer(path)
    );
    await this.checkBundleOnServer(path);
  }
  // processing bundles of files hashes
  private async createSingleHashBundle(
    path: string
  ): Promise<DeepCode.BundlesInterface> {
    const newBundle: DeepCode.BundlesInterface = await createFilesHashesBundle(
      path,
      this.serverFilesFilterList
    );
    return newBundle;
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

  private async sendRemoteBundleToServer(
    workspacePath: string,
    bundleForServer: {
      [key: string]: string;
    }
  ): Promise<void> {
    try {
      const serverBundle: DeepCode.RemoteBundleInterface = await http.post(
        this.config.createBundleUrl,
        {
          body: bundleForServer.repo
            ? bundleForServer
            : createBundleBody(bundleForServer),
          token: this.token
        }
      );
      await this.processBundleFromServer(serverBundle, workspacePath);
    } catch (err) {
      if (err.error === MISSING_CONSENT) {
        if (this.remoteBundles[workspacePath]) {
          this.remoteBundles = {};
        }
      }
      await this.errorHandler.processError(this, err, {
        workspacePath,
        removedBundle: !!Object.keys(this.remoteBundles).length,
        errorDetails: {
          message: errorsLogs.createBundle,
          endpoint: this.config.createBundleUrl
        }
      });
    }
  }

  private async processBundleFromServer(
    serverBundle: DeepCode.RemoteBundleInterface,
    workspacePath: string
  ): Promise<void> {
    await this.updateExtensionRemoteBundles(workspacePath, serverBundle);
    // if server bundles has missing files - upload them to server
    if (this.remoteBundles[workspacePath].missingFiles) {
      await this.uploadMissingFilesToServerBundle(workspacePath);
    }
  }
  // processing missing files in bundles
  private async createMissingFilesPayload(
    missingFiles: Array<string> | undefined,
    workspacePath: string
  ): Promise<Array<DeepCode.PayloadMissingFileInterface>> {
    const path = this.workspacesPaths.find(path => path === workspacePath);
    if (Array.isArray(missingFiles) && path) {
      return await createMissingFilesPayload([...missingFiles], path);
    }
    return [];
  }

  public async uploadMissingFilesToServerBundle(
    workspacePath: string,
    chunkedPayload: any = []
  ): Promise<void> {
    const { bundleId } = this.remoteBundles[workspacePath];
    const endpoint = this.config.getUploadFilesUrl(bundleId);
    let payload: Array<DeepCode.PayloadMissingFileInterface> = [];
    const sendUploadRequest = async (chunkPayload: any): Promise<void> => {
      try {
        const uploadResponse = await http.post(endpoint, {
          body: chunkPayload,
          token: this.token,
          fileUpload: true
        });
      } catch (err) {
        if (err.statusCode === statusCodes.bigPayload) {
          await this.uploadMissingFilesToServerBundle(
            workspacePath,
            chunkPayload
          );
        } else {
          this.errorHandler.processError(this, err, {
            errorDetails: {
              message: errorsLogs.uploadFiles,
              endpoint,
              bundleId,
              data: {
                missingFiles: chunkPayload
              }
            }
          });
        }
      }
    };

    if (!chunkedPayload.length) {
      const { missingFiles } = this.remoteBundles[workspacePath];
      payload = await this.createMissingFilesPayload(
        missingFiles,
        workspacePath
      );
      if (!payload.length) {
        return;
      }
    } else {
      payload = chunkedPayload;
    }
    const processedPayload = processPayloadSize(payload);
    if (processedPayload.chunks) {
      for await (const chunkPayload of processedPayload.payload) {
        await sendUploadRequest(chunkPayload);
      }
    } else {
      await sendUploadRequest(processedPayload.payload);
    }
  }
  // check bundle server status
  public async checkBundleOnServer(
    workspacePath: string,
    attempts: number = ATTEMPTS_AMMOUNT
  ): Promise<void> {
    if (!this.remoteBundles[workspacePath]) {
      return;
    }
    const endpoint = this.config.getbundleIdUrl(
      this.remoteBundles[workspacePath].bundleId
    );
    try {
      if (!attempts) {
        throw new Error(EXPIRED_REQUEST);
      }
      const latestServerBundle: DeepCode.RemoteBundleInterface = await http.get(
        endpoint,
        this.token
      );
      await this.processBundleFromServer(latestServerBundle, workspacePath);
      if (this.remoteBundles[workspacePath].missingFiles) {
        await this.checkBundleOnServer(workspacePath, attempts--);
      }
    } catch (err) {
      let message = errorsLogs.checkBundle;
      if (err.message === EXPIRED_REQUEST) {
        message = errorsLogs.checkBundleAfterAttempts(ATTEMPTS_AMMOUNT);
      }
      this.errorHandler.processError(this, err, {
        workspacePath,
        errorDetails: {
          message,
          endpoint,
          bundleId: this.remoteBundles[workspacePath].bundleId
        }
      });
    }
  }
  // extending bundles
  public async extendWorkspaceHashesBundle(
    updatedFiles: Array<{
      [key: string]: string;
    }>,
    workspacePath: string
  ): Promise<void> {
    const currentWorkspaceBundle = {
      ...this.hashesBundles[workspacePath]
    };
    for (const updatedFile of updatedFiles) {
      if (
        updatedFile.status === FILE_CURRENT_STATUS.deleted &&
        currentWorkspaceBundle[updatedFile.filePath]
      ) {
        delete currentWorkspaceBundle[updatedFile.filePath];
      }
      if (
        updatedFile.status === FILE_CURRENT_STATUS.modified ||
        updatedFile.status === FILE_CURRENT_STATUS.created
      ) {
        currentWorkspaceBundle[updatedFile.filePath] = updatedFile.fileHash;
      }
    }
    this.hashesBundles[workspacePath] = {
      ...currentWorkspaceBundle
    };
  }

  public async extendBundleOnServer(
    updatedFiles: Array<{
      [key: string]: string;
    }>,
    workspacePath: string
  ): Promise<void> {
    if (!this.remoteBundles[workspacePath]) {
      return;
    }

    const extendBatchBody: {
      files: { [key: string]: string };
      removedFiles: Array<string>;
    } = {
      files: {},
      removedFiles: []
    };
    const { created, modified, deleted } = FILE_CURRENT_STATUS;
    for await (const updatedFile of updatedFiles) {
      const { status, filePath = "", fileHash = "" } = updatedFile;
      if (status === modified || status === created) {
        extendBatchBody.files = {
          ...extendBatchBody.files,
          [filePath]: fileHash
        };
      }
      if (status === deleted) {
        extendBatchBody.removedFiles.push(filePath);
      }
    }
    const endpoint = this.config.getbundleIdUrl(
      this.remoteBundles[workspacePath].bundleId
    );
    try {
      const extendedServerBundle = await http.put(endpoint, {
        body: extendBatchBody,
        token: this.token
      });
      await this.processBundleFromServer(extendedServerBundle, workspacePath);
    } catch (err) {
      if (err.error === MISSING_CONSENT) {
        if (this.remoteBundles[workspacePath]) {
          this.remoteBundles = {};
        }
      }

      this.errorHandler.processError(this, err, {
        workspacePath,
        removedBundle: !!Object.keys(this.remoteBundles).length,
        errorDetails: {
          message: errorsLogs.extendBundle,
          endpoint,
          bundleId: this.remoteBundles[workspacePath]
            ? this.remoteBundles[workspacePath].bundleId
            : "",
          data: {
            ...extendBatchBody
          }
        }
      });
    }
  }
}

export default BundlesModule;
