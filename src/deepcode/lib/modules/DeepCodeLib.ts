import * as _ from "lodash";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import BundlesModule from "./BundlesModule";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT } from "../../constants/views";
import { EXECUTION_DEBOUNCE_INTERVAL } from "../../constants/general";

export default class DeepCodeLib extends BundlesModule implements DeepCode.DeepCodeLibInterface {
  private executing = false;
  
  activateAll(): void {
    // this.filesWatcher.activate(this);
    this.workspacesWatcher.activate(this);
    this.editorsWatcher.activate(this);
    this.settingsWatcher.activate(this);
    this.analyzer.activate(this);
  }

  private async executeExtensionPipeline(): Promise<void> {
    console.log("DeepCode: starting execution pipeline");
    setContext(DEEPCODE_CONTEXT.ERROR, false);
    
    const loggedIn = await this.checkSession();
    if (!loggedIn) return;
    const approved = await this.checkApproval();
    if (!approved) return;
    await this.startAnalysis();
    
    this.resetTransientErrors();
  }

  startExtension = _.debounce(
    async (): Promise<void> => {
      // This function is called by commands, error handlers, etc.
      // We should avoid having duplicate parallel executions.
      try {
        await this.executeExtensionPipeline();
      } catch (err) {
        this.processError(err);
      }
    },
    EXECUTION_DEBOUNCE_INTERVAL,
    { 'leading': true }
  );
}
