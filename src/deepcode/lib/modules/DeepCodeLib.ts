import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import BundlesModule from "./BundlesModule";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT } from "../../constants/views";

export default class DeepCodeLib extends BundlesModule implements DeepCode.DeepCodeLibInterface {
  private executing = false;
  
  public activateAll(): void {
    // this.filesWatcher.activate(this);
    this.workspacesWatcher.activate(this);
    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
    this.analyzer.activate(this);
  }

  private async executeExtensionPipeline(): Promise<void> {
    console.log("DeepCode: starting execution pipeline");
    setContext(DEEPCODE_CONTEXT.ERROR, false);
    
    let loggedIn = await this.checkSession();
    if (!loggedIn) return;
    let approved = await this.checkApproval();
    if (!approved) return;
    await this.startAnalysis();
    
    this.resetTransientErrors();
  }

  public async startExtension(): Promise<void> {
    // This function is called by commands, error handlers, etc.
    // We should avoid having duplicate parallel executions.
    if (this.executing) return;
    this.executing = true;
    try {
      await this.executeExtensionPipeline();
      this.executing = false;
    } catch (err) {
      this.executing = false;
      this.processError(err);
    }
  }
}
