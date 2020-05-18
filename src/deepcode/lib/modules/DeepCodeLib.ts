import * as vscode from "vscode";
import * as path from "path";
import * as nodeFs from "fs";

import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import BundlesModule from "./BundlesModule";

// import { INSTALL_STATUS, STATUSFILE_NAME, DEEPCODE_NAME } from "../../constants/general";

export default class DeepCodeLib extends BundlesModule implements DeepCode.DeepCodeLibInterface {
  
  public activateWatchers(): void {
    this.filesWatcher.activate(this);
    this.workspacesWatcher.activate(this);
    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
  }

  // public async preActivateActions(): Promise<void> {
  //   // let status = INSTALL_STATUS.installed;
  //   // if (process.env.NODE_ENV === "production") {
  //   //   status = this.manageExtensionStatus();
  //   // }
  //   await this.activateActions();    
  // }

  // public manageExtensionStatus(): string {
  //   const extension = vscode.extensions.all.find(
  //     el => el.packageJSON.displayName === DEEPCODE_NAME
  //   );
  //   if (extension) {
  //     const statusFilePath = path.join(extension.extensionPath, `/${STATUSFILE_NAME}`);
  //     const extensionStatus = nodeFs.readFileSync(statusFilePath, "utf8");
  //     if (extensionStatus === INSTALL_STATUS.justInstalled) {
  //       this.store.cleanStore();
  //       nodeFs.writeFileSync(statusFilePath, INSTALL_STATUS.installed);
  //       return INSTALL_STATUS.justInstalled;
  //     }
  //   }
  //   return INSTALL_STATUS.installed;
  // }

  public async activateExtensionAnalyzeActions(): Promise<void> {
    const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || !workspaceFolders.length) {
      return;
    }

    this.createWorkspacesList(workspaceFolders);
    if (this.workspacesPaths.length) {
      this.updateCurrentWorkspacePath(this.workspacesPaths[0]);
      
      await this.updateHashesBundles();

      try {
        // Main entry point to 
        for await (const path of this.workspacesPaths) {
          await this.performBundlesActions(path);
        }
      } catch(err) {
        await this.errorHandler.processError(this, err);
      }
    }
  }
}
