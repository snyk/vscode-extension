import * as vscode from 'vscode';
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import { DeepCodeWatcherInterface, ExtensionInterface } from "../../../interfaces/DeepCodeInterfaces";

class DeepCodeFilesWatcher implements DeepCodeWatcherInterface {
  private changedFilesList: Array<string> = [];
  private watcher: vscode.FileSystemWatcher | null = null;
  private FILES_TO_SAVE_LIST_FIRST_ELEMENT: number = 1;
  private filesForUpdatingServerBundle: {
    [key: string]: Array<{
      [key: string]: string;
    }>;
  } = {};

  private emptyChangedFilesLists(): void {
    // clear files lists
    this.changedFilesList.length = 0;
    this.filesForUpdatingServerBundle = {};
  }

  private async getFileWorkspacePath(filePath: string): Promise<string> {
    const fileWorkspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!fileWorkspace) {
      return '';
    }
    return fileWorkspace.uri.fsPath;
  }

  private updateCorrespondingFilesList(fileWorkspacePath: string, payload: { [key: string]: string }): void {
    this.filesForUpdatingServerBundle[fileWorkspacePath] = this.filesForUpdatingServerBundle[fileWorkspacePath]
      ? [...this.filesForUpdatingServerBundle[fileWorkspacePath], payload]
      : [payload];
  }

  private async performBundlesAndReviewActions(extension: ExtensionInterface): Promise<void> {
    if (Object.keys(this.filesForUpdatingServerBundle).length) {
      await extension.startExtension();
    }
    this.emptyChangedFilesLists();
  }

  private async updateFilesActions(extension: ExtensionInterface, type: string): Promise<void> {
    if (type === 'deleted') {
      for await (const filePath of this.changedFilesList) {
        const fileWorkspacePath = await this.getFileWorkspacePath(filePath);
        this.updateCorrespondingFilesList(fileWorkspacePath, {
          status: 'deleted',
          filePath: filePath.split(fileWorkspacePath)[1],
        });
      }
    } else {
      for await (const filePath of this.changedFilesList) {
        const fileWorkspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!fileWorkspace) {
          continue;
        }
        const fileWorkspacePath = await this.getFileWorkspacePath(filePath);
        try {
          // if (['modified', 'created', 'deleted'].includes(updatedFile.status)) {
          //   this.updateCorrespondingFilesList(fileWorkspacePath, updatedFile);
          // }
        } catch (err) {
          const filePathInBundle = filePath.split(fileWorkspacePath)[1];

          await extension.processError(err, {
            message: errorsLogs.watchFileBeforeExtendBundle,
            bundleId: extension.remoteBundle.bundleId,
            data: {
              [filePathInBundle]: errorsLogs.modifiedFile(type),
            },
          });
        }
      }
    }
    // fire bundles changes and review updated code
    await this.performBundlesAndReviewActions(extension);
  }

  private async updateFiles(filePath: string, extension: ExtensionInterface, type: string): Promise<void> {
    // if (!isFileChangingBundle(filePath)) {
    //   return;
    // }
    if (!this.changedFilesList.includes(filePath)) {
      this.changedFilesList.push(filePath);
      if (this.changedFilesList.length === this.FILES_TO_SAVE_LIST_FIRST_ELEMENT) {
        setImmediate(async () => await this.updateFilesActions(extension, type));
      }
    }
  }

  public activate(extension: ExtensionInterface): void {
    const { extensions = [], configFiles = [] } = {};

    const watchFiles = [...extensions.map(e => `*${e}`), ...configFiles];

    const globPattern: vscode.GlobPattern = `**/\{${watchFiles.join(',')}\}`;
    this.watcher = vscode.workspace.createFileSystemWatcher(globPattern);

    this.watcher.onDidChange((documentUri: vscode.Uri) => {
      this.updateFiles(documentUri.fsPath, extension, 'modified');
    });
    this.watcher.onDidDelete(async (documentUri: vscode.Uri) => {
      this.updateFiles(documentUri.fsPath, extension, 'deleted');
    });

    this.watcher.onDidCreate((documentUri: vscode.Uri) => {
      this.updateFiles(documentUri.fsPath, extension, 'created');
    });
  }
}
export default DeepCodeFilesWatcher;
