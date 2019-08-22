import * as nodeFs from "fs";
import * as path from "path";
import DeepCode from "../interfaces/DeepCodeInterfaces";
import { ExtensionContext, Memento, extensions } from "vscode";
import { stateNames } from "../deepcode/constants/stateNames";
import {
  INSTALL_STATUS,
  STATUSFILE_NAME,
  DEEPCODE_NAME
} from "../deepcode/constants/general";

class DeepCodeStore implements DeepCode.ExtensionStoreInterface {
  private state: Memento | any = {};
  public selectors: DeepCode.StateSelectorsInterface = {};
  public actions: DeepCode.StateSelectorsInterface = {};

  private createSelectors(): DeepCode.StateSelectorsInterface {
    return {
      getLoggedInStatus: (): string | undefined =>
        this.state.get(stateNames.isLoggedIn),

      getAccountType: (): string | undefined =>
        this.state.get(stateNames.accountType),

      getConfirmUploadStatus: (): string | undefined =>
        this.state.get(stateNames.confirmedDownload),

      getSessionToken: (): string | undefined =>
        this.state.get(stateNames.sessionToken)
    };
  }

  private createStateActions(): DeepCode.StateSelectorsInterface {
    return {
      setLoggedInStatus: (status: boolean): Thenable<void> =>
        this.state.update(stateNames.isLoggedIn, status),
      setAccountType: (type: string): Thenable<void> =>
        this.state.update(stateNames.accountType, type),
      setConfirmUploadStatus: (status: boolean): Thenable<void> =>
        this.state.update(stateNames.confirmedDownload, status),
      setSessionToken: (token: string): Thenable<void> =>
        this.state.update(stateNames.sessionToken, token)
    };
  }

  private cleanGlobalStore(): void {
    this.actions.setLoggedInStatus(false);
    this.actions.setSessionToken("");
    this.actions.setConfirmUploadStatus(false);
    this.actions.setAccountType("");
  }

  private manageExtensionStatus(): void {
    const extension = extensions.all.find(
      el => el.packageJSON.displayName === DEEPCODE_NAME
    );
    if (extension) {
      const statusFilePath = path.join(
        extension.extensionPath,
        `/${STATUSFILE_NAME}`
      );
      const extensionStatus = nodeFs.readFileSync(statusFilePath, "utf8");
      if (extensionStatus === INSTALL_STATUS.justInstalled) {
        this.cleanGlobalStore();
        nodeFs.writeFileSync(statusFilePath, INSTALL_STATUS.installed);
      }
    }
  }
  public async createStore(context: ExtensionContext): Promise<void> {
    this.state = context.globalState;
    this.selectors = { ...this.createSelectors() };
    this.actions = { ...this.createStateActions() };
    if (process.env.NODE_ENV === "production") {
      this.manageExtensionStatus();
    }
  }
}

export default DeepCodeStore;
