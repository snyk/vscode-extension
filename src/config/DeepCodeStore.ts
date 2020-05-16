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
      getSessionToken: (): string | undefined =>
        this.globalState.get(stateNames.sessionToken),
      getServerConnectionAttempts: (): number =>
        this.globalState.get(stateNames.serverConnectionAttempts)
    };
  }

  private createStateActions(): DeepCode.StateSelectorsInterface {
    return {
      setSessionToken: (token: string): Thenable<void> =>
        this.globalState.update(stateNames.sessionToken, token),
      setServerConnectionAttempts: (attempts: number): Thenable<void> =>
        this.globalState.update(stateNames.serverConnectionAttempts, attempts),
    };
  }

  public cleanStore(): void {
    this.actions.setSessionToken("");
    this.actions.setServerConnectionAttempts(10);
  }

  public async createStore(context: ExtensionContext): Promise<void> {
    this.globalState = context.globalState;
    this.workspaceState = context.workspaceState;
    this.selectors = { ...this.createSelectors() };
    this.actions = { ...this.createStateActions() };
  }
}

export default DeepCodeStore;
