import DeepCode from "../interfaces/DeepCodeInterfaces";
import { ExtensionContext, Memento } from "vscode";

class DeepCodeStore implements DeepCode.ExtensionStoreInterface {
  private globalState: Memento | any = {};
  public selectors: DeepCode.StateSelectorsInterface = {};
  public actions: DeepCode.StateSelectorsInterface = {};

  private createSelectors(): DeepCode.StateSelectorsInterface {
    return {};
  }

  private createStateActions(): DeepCode.StateSelectorsInterface {
    return {};
  }

  public cleanStore(): void {
  }

  public async createStore(context: ExtensionContext): Promise<void> {
    this.globalState = context.globalState;
    this.selectors = { ...this.createSelectors() };
    this.actions = { ...this.createStateActions() };
  }
}

export default DeepCodeStore;
