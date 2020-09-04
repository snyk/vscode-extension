import * as _ from "lodash";
import { DeepCodeLibInterface } from "../../../interfaces/DeepCodeInterfaces";
import BundlesModule from "./BundlesModule";
import { DEEPCODE_CONTEXT, DEEPCODE_MODE_CODES } from "../../constants/views";
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import {
  EXECUTION_DEBOUNCE_INTERVAL,
  EXECUTION_THROTTLING_INTERVAL,
  EXECUTION_PAUSE_INTERVAL,
} from "../../constants/general";

export default class DeepCodeLib extends BundlesModule implements DeepCodeLibInterface {
  private _mode = DEEPCODE_MODE_CODES.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastThrottledExecution: number | undefined;

  private shouldBeThrottled(): boolean {
    if (this._mode !== DEEPCODE_MODE_CODES.THROTTLED) return false;
    const now = Date.now();
    if (
      this._lastThrottledExecution === undefined ||
      (now - this._lastThrottledExecution) >= EXECUTION_THROTTLING_INTERVAL
    ) {
      this._lastThrottledExecution = now;
      return false;
    }
    return true;
  }

  private unpause(): void {
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
    await this.setContext(DEEPCODE_CONTEXT.ERROR, false);
    this.resetTransientErrors();
    await this.setLoadingBadge(false);

    if (!this.token) return;
    const approved = await this.checkApproval();
    if (!approved) return;

    await this.startAnalysis();
  }

  public async startExtension(manual: Boolean = false): Promise<void> {
    // If the execution is suspended, we only allow user-triggered analyses.
    if (!manual) {
      if ([
          DEEPCODE_MODE_CODES.MANUAL,
          DEEPCODE_MODE_CODES.PAUSED
        ].includes(this._mode) ||
        this.shouldBeThrottled()
      ) return;
    }

    // This function is called by commands, error handlers, etc.
    // We should avoid having duplicate parallel executions.
    _.debounce(
      async () => {
        try {
          await this.executeExtensionPipeline();
        } catch (err) {
          await this.processError(err, {
            message: errorsLogs.failedExecutionDebounce,
          });
        }
      },
      EXECUTION_DEBOUNCE_INTERVAL,
      { 'leading': true }
    );
  };

  async setMode(mode: string): Promise<void> {
    if (!Object.values(DEEPCODE_MODE_CODES).includes(mode)) return;
    this._mode = mode;
    await this.setContext(DEEPCODE_CONTEXT.MODE, mode);
    switch(mode) {
      case DEEPCODE_MODE_CODES.PAUSED:
        this._unpauseTimeout = setTimeout(this.unpause.bind(this), EXECUTION_PAUSE_INTERVAL);
        break;
      case DEEPCODE_MODE_CODES.AUTO:
      case DEEPCODE_MODE_CODES.MANUAL:
      case DEEPCODE_MODE_CODES.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
    }
  }
}
