import * as _ from "lodash";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import BundlesModule from "./BundlesModule";
import { setContext } from "../../utils/vscodeCommandsUtils";
import { DEEPCODE_CONTEXT, DEEPCODE_MODE_CODES } from "../../constants/views";
import { 
  EXECUTION_DEBOUNCE_INTERVAL,
  EXECUTION_DEBOUNCE_EXTENDED_INTERVAL,
  EXECUTION_PAUSE_INTERVAL, 
} from "../../constants/general";

export default class DeepCodeLib extends BundlesModule implements DeepCode.DeepCodeLibInterface {
  private _mode = DEEPCODE_MODE_CODES.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;

  private unpause() {
    if (this._mode === DEEPCODE_MODE_CODES.PAUSED) this.setMode(DEEPCODE_MODE_CODES.AUTO);
  }
  
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

  private getDebouncedExecution(wait: number) {
    return _.debounce(
      async (manual = false): Promise<void> => {
        // If the execution is suspended, we only allow user-triggered analyses.
        if (!manual && [
          DEEPCODE_MODE_CODES.MANUAL,
          DEEPCODE_MODE_CODES.PAUSED
        ].includes(this._mode)) return;
        // This function is called by commands, error handlers, etc.
        // We should avoid having duplicate parallel executions.
        try {
          await this.executeExtensionPipeline();
        } catch (err) {
          this.processError(err);
        }
      },
      wait,
      { 'leading': true }
    );
  }

  startExtension = this.getDebouncedExecution(EXECUTION_DEBOUNCE_INTERVAL);

  setMode(mode: string): void {
    if (!Object.values(DEEPCODE_MODE_CODES).includes(mode)) return;
    this._mode = mode;
    setContext(DEEPCODE_CONTEXT.MODE, mode);
    switch(mode) {
      case DEEPCODE_MODE_CODES.PAUSED:
        this._unpauseTimeout = setTimeout(this.unpause.bind(this), EXECUTION_PAUSE_INTERVAL);
        this.startExtension = this.getDebouncedExecution(EXECUTION_DEBOUNCE_INTERVAL);
        break;
      case DEEPCODE_MODE_CODES.AUTO:
      case DEEPCODE_MODE_CODES.MANUAL:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        this.startExtension = this.getDebouncedExecution(EXECUTION_DEBOUNCE_INTERVAL);
        break;
      case DEEPCODE_MODE_CODES.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        this.startExtension = this.getDebouncedExecution(EXECUTION_DEBOUNCE_EXTENDED_INTERVAL);
        break;
    }
  }
}
