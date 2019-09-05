import DeepCode from "../interfaces/DeepCodeInterfaces";
import { ExtensionContext, Memento } from "vscode";
import { stateNames } from "../deepcode/constants/stateNames";

class DeepCodeStore implements DeepCode.ExtensionStoreInterface {
  private globalState: Memento | any = {};
  private workspaceState: Memento | any = {};
  public selectors: DeepCode.StateSelectorsInterface = {};
  public actions: DeepCode.StateSelectorsInterface = {};

  private createSelectors(): DeepCode.StateSelectorsInterface {
    return {
      getLoggedInStatus: (): string | undefined =>
        this.globalState.get(stateNames.isLoggedIn),

      getAccountType: (): string | undefined =>
        this.globalState.get(stateNames.accountType),

      getConfirmUploadStatus: (): string | undefined =>
        // TODO: change to workspace state
        this.globalState.get(stateNames.confirmedDownload),

      getSessionToken: (): string | undefined =>
        this.globalState.get(stateNames.sessionToken),
      getBackendConfigStatus: (): string | undefined =>
        this.globalState.get(stateNames.isBackendConfigured)
    };
  }

  private createStateActions(): DeepCode.StateSelectorsInterface {
    return {
      setLoggedInStatus: (status: boolean): Thenable<void> =>
        this.globalState.update(stateNames.isLoggedIn, status),
      setAccountType: (type: string): Thenable<void> =>
        this.globalState.update(stateNames.accountType, type),
      setConfirmUploadStatus: (status: boolean): Thenable<void> =>
        // TODO: change to workspace state
        this.globalState.update(stateNames.confirmedDownload, status),
      setSessionToken: (token: string): Thenable<void> =>
        this.globalState.update(stateNames.sessionToken, token),
      setBackendConfigStatus: (status: boolean = true): Thenable<void> =>
        this.globalState.update(stateNames.isBackendConfigured, status)
    };
  }

  public cleanStore(): void {
    this.actions.setLoggedInStatus(false);
    this.actions.setSessionToken("");
    this.actions.setConfirmUploadStatus(false);
    this.actions.setAccountType("");
    this.actions.setBackendConfigStatus(false);
  }

  public async createStore(context: ExtensionContext): Promise<void> {
    this.globalState = context.globalState;
    // this.workspaceState = context.workspaceState;
    this.selectors = { ...this.createSelectors() };
    this.actions = { ...this.createStateActions() };
    // TODO: remove after tests
    // this.cleanStore();
    // console.log(this.selectors.getConfirmUploadStatus());
    //
  }
}

export default DeepCodeStore;
