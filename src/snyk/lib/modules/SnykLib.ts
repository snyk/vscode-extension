import * as _ from "lodash";
import { SnykLibInterface } from "../../../interfaces/SnykInterfaces";
import BundlesModule from "./BundlesModule";
import { SNYK_CONTEXT, SNYK_MODE_CODES } from '../../constants/views';
import { errorsLogs } from "../../messages/errorsServerLogMessages";
import {
  EXECUTION_DEBOUNCE_INTERVAL,
  EXECUTION_THROTTLING_INTERVAL,
  EXECUTION_PAUSE_INTERVAL,
} from "../../constants/general";

export default class SnykLib extends BundlesModule implements SnykLibInterface {
  private _mode = SNYK_MODE_CODES.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastThrottledExecution: number | undefined;

  private shouldBeThrottled(): boolean {
    if (this._mode !== SNYK_MODE_CODES.THROTTLED) return false;
    const now = Date.now();
    if (
      this._lastThrottledExecution === undefined ||
      now - this._lastThrottledExecution >= EXECUTION_THROTTLING_INTERVAL
    ) {
      this._lastThrottledExecution = now;
      return false;
    }
    return true;
  }

  private unpause(): void {
    if (this._mode === SNYK_MODE_CODES.PAUSED) this.setMode(SNYK_MODE_CODES.AUTO);
  }

  private async startExtension_(manual: Boolean = false): Promise<void> {
    console.log('STARTING EXTENSION');
    // If the execution is suspended, we only allow user-triggered analyses.
    if (!manual) {
      if ([SNYK_MODE_CODES.MANUAL, SNYK_MODE_CODES.PAUSED].includes(this._mode) || this.shouldBeThrottled())
        return;
    }

    await this.setContext(SNYK_CONTEXT.ERROR, false);
    this.resetTransientErrors();
    await this.setLoadingBadge(false);

    if (!this.token) {
      await this.checkSession();
      return;
    }
    await this.setContext(SNYK_CONTEXT.LOGGEDIN, true);

    const uploadApproved = await this.checkApproval();
    if (!uploadApproved) {
      return;
    }

    try {
      await this.startAnalysis();
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedExecutionDebounce,
      });
    }
  }

  // This function is called by commands, error handlers, etc.
  // We should avoid having duplicate parallel executions.
  public startExtension = _.debounce(this.startExtension_.bind(this), EXECUTION_DEBOUNCE_INTERVAL, { leading: true });

  async setMode(mode: string): Promise<void> {
    if (!Object.values(SNYK_MODE_CODES).includes(mode)) return;
    this._mode = mode;
    await this.setContext(SNYK_CONTEXT.MODE, mode);
    switch (mode) {
      case SNYK_MODE_CODES.PAUSED:
        this._unpauseTimeout = setTimeout(this.unpause.bind(this), EXECUTION_PAUSE_INTERVAL);
        break;
      case SNYK_MODE_CODES.AUTO:
      case SNYK_MODE_CODES.MANUAL:
      case SNYK_MODE_CODES.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
    }
  }
}
