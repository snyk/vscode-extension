import * as vscode from "vscode";
import { compareFileChanges, acceptFileToBundle, isFileChangingBundle } from "../../utils/filesUtils";
import { debounce } from "../../utils/tsUtils";
import {
  FILE_CURRENT_STATUS,
  GIT_FILENAME
} from "../../constants/filesConstants";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";

class DeepCodeFilesWatcher implements DeepCode.DeepCodeWatcherInterface {
  private changedFilesList: Array<string> = [];
  private watcher: vscode.FileSystemWatcher;
  private FILES_TO_SAVE_LIST_FIRST_ELEMENT: number = 1;
  private filesForUpdatingServerBundle: {
    [key: string]: Array<{
      [key: string]: string;
    }>
  } = {};

  constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.*");
  }

  private async checksBeforeActions(
    extension: DeepCode.ExtensionInterface,
    filePath: string
  ): Promise<boolean> {
    // first save checks
    let fileWorkspacePath = extension.workspacesPaths.find(path =>
      filePath.includes(path)
    );
    if (!fileWorkspacePath) {
      fileWorkspacePath = "";
    }

    if (!(await extension.checkPermissions(extension, fileWorkspacePath))) {
      return false;
    }
    return true;
  }

  private emptyChangedFilesLists(): void {
    // clear files lists
    this.changedFilesList.length = 0;
    this.filesForUpdatingServerBundle = {};
  }

  private async getFileWorkspacePath(filePath: string): Promise<string> {
    const fileWorkspace = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(filePath)
    );
    if (!fileWorkspace) {
      return "";
    }
    return fileWorkspace.uri.fsPath;
  }

  private updateCorrespondingFilesList(
    fileWorkspacePath: string,
    filePath: string,
    payload: { [key: string]: string }
  ): void {
    this.filesForUpdatingServerBundle[fileWorkspacePath] = this
      .filesForUpdatingServerBundle[fileWorkspacePath]
      ? [...this.filesForUpdatingServerBundle[fileWorkspacePath], payload]
      : [payload];
  }

  private async performBundlesAndReviewActions(
    extension: DeepCode.ExtensionInterface
  ): Promise<void> {
    if (Object.keys(this.filesForUpdatingServerBundle).length) {
      for (const workspacePath in this.filesForUpdatingServerBundle) {
        const updatedFiles = this.filesForUpdatingServerBundle[workspacePath];
        if (!extension.checkUploadConfirm(workspacePath)) {
          continue;
        }
        await extension.extendWorkspaceHashesBundle(
          updatedFiles,
          workspacePath
        );
        let updated = false;
        if (updatedFiles.some(({filePath}) => isFileChangingBundle(filePath))) {
          await extension.updateHashesBundles(workspacePath);
          updated = true;
        }
        if (extension.remoteBundles[workspacePath] && !updated) {
          await extension.extendBundleOnServer(updatedFiles, workspacePath);
          await extension.checkBundleOnServer(workspacePath);
        } else {
          await extension.performBundlesActions(workspacePath);
        }
        const debouncedAnalyzeFunc = debounce(extension.analyzer.reviewCode);
        await debouncedAnalyzeFunc(extension);
      }
    }
    this.emptyChangedFilesLists();
  }

  private async updateFilesActions(
    extension: DeepCode.ExtensionInterface,
    type: string
  ): Promise<void> {
    if (type === FILE_CURRENT_STATUS.deleted) {
      for await (const filePath of this.changedFilesList) {
        const fileWorkspacePath = await this.getFileWorkspacePath(filePath);
        this.updateCorrespondingFilesList(fileWorkspacePath, filePath, {
          status: FILE_CURRENT_STATUS.deleted,
          filePath: filePath.split(fileWorkspacePath)[1]
        });
      }
    } else {
      for await (const filePath of this.changedFilesList) {
        const fileWorkspace = vscode.workspace.getWorkspaceFolder(
          vscode.Uri.file(filePath)
        );
        if (!fileWorkspace) {
          continue;
        }
        const fileWorkspacePath = await this.getFileWorkspacePath(filePath);
        try {
          const updatedFile = await compareFileChanges(
            filePath,
            fileWorkspacePath,
            extension.hashesBundles[fileWorkspacePath]
          );
          const { modified, created, deleted } = FILE_CURRENT_STATUS;
          if (
            updatedFile.status === modified ||
            updatedFile.status === created ||
            updatedFile.status === deleted
          ) {
            this.updateCorrespondingFilesList(fileWorkspacePath, filePath, {
              ...updatedFile
            });
          }
        } catch (err) {
          const filePathInBundle = filePath.split(fileWorkspacePath)[1];
          extension.errorHandler.processError(extension, err, {
            errorDetails: {
              message: errorsLogs.watchFileBeforeExtendBundle,
              bundleId: extension.remoteBundles[fileWorkspacePath].bundleId,
              data: {
                [filePathInBundle]: errorsLogs.modifiedFile(type)
              }
            }
          });
        }
      }
    }
    // fire bundles changes and review updated code
    await this.performBundlesAndReviewActions(extension);
  }

  private async updateFiles(
    filePath: string,
    extension: DeepCode.ExtensionInterface,
    type: string
  ): Promise<void> {
    if (
      !acceptFileToBundle(filePath, extension.serverFilesFilterList) &&
      !isFileChangingBundle(filePath)
    ) {
      return;
    }
    if (!this.changedFilesList.includes(filePath)) {
      this.changedFilesList.push(filePath);
      if (
        this.changedFilesList.length === this.FILES_TO_SAVE_LIST_FIRST_ELEMENT
      ) {
        setImmediate(
          async () => await this.updateFilesActions(extension, type)
        );
      }
    }
  }

  private async ignoreFilesCaches(
    filePath: string,
    extension: DeepCode.ExtensionInterface
  ): Promise<string> {
    if (!(await this.checksBeforeActions(extension, filePath))) {
      this.emptyChangedFilesLists();
      return "";
    }
    const fileWorkspacePath = extension.workspacesPaths.find(path =>
      filePath.includes(path)
    );
    if (!fileWorkspacePath) {
      return "";
    }
    const hashedFilesBundle = extension.hashesBundles[fileWorkspacePath];
    const filePathInBundle = filePath.split(fileWorkspacePath)[1];
    if (!hashedFilesBundle) {
      return "";
    }
    const originFilePath = Object.keys(hashedFilesBundle).find(path =>
      filePathInBundle.includes(path)
    );
    const result = originFilePath
      ? `${fileWorkspacePath}${originFilePath}`
      : filePath;
    return result;
  }

  private async filesChangesHandler(
    filePath: string,
    extension: DeepCode.ExtensionInterface,
    type: string
  ): Promise<void> {
    // Exclude changes to the .git directory.
    if (filePath.includes(`/${GIT_FILENAME}/`)) {
      return;
    }
    const originFilePath = await this.ignoreFilesCaches(filePath, extension);
    if (originFilePath) {
      this.updateFiles(originFilePath, extension, type);
    }
  }

  public activate(extension: DeepCode.ExtensionInterface): void {
    const { created, modified, deleted } = FILE_CURRENT_STATUS;

    this.watcher.onDidChange((documentUri: vscode.Uri) => {
      this.filesChangesHandler(documentUri.fsPath, extension, modified);
    });
    this.watcher.onDidDelete(async (documentUri: vscode.Uri) => {
      this.filesChangesHandler(documentUri.fsPath, extension, deleted);
    });

    this.watcher.onDidCreate((documentUri: vscode.Uri) => {
      this.filesChangesHandler(documentUri.fsPath, extension, created);
    });
  }
}
export default DeepCodeFilesWatcher;
