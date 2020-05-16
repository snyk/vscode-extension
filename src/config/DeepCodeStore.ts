import DeepCode from "../interfaces/DeepCodeInterfaces";
import { ExtensionContext, Memento } from "vscode";
import { stateNames } from "../deepcode/constants/stateNames";

class DeepCodeStore implements DeepCode.ExtensionStoreInterface {
  private globalState: Memento | any = {};
  public selectors: DeepCode.StateSelectorsInterface = {};
  public actions: DeepCode.StateSelectorsInterface = {};

  private createSelectors(): DeepCode.StateSelectorsInterface {
    return {
      getServerConnectionAttempts: (): number =>
        this.globalState.get(stateNames.serverConnectionAttempts)
    };
  }

  private createStateActions(): DeepCode.StateSelectorsInterface {
    return {
      setServerConnectionAttempts: (attempts: number): Thenable<void> =>
        this.globalState.update(stateNames.serverConnectionAttempts, attempts),
    };
  }

  public cleanStore(): void {
    this.actions.setServerConnectionAttempts(10);
  }

  public async createStore(context: ExtensionContext): Promise<void> {
    this.globalState = context.globalState;
    this.selectors = { ...this.createSelectors() };
    this.actions = { ...this.createStateActions() };
  }
}

export default DeepCodeStore;
