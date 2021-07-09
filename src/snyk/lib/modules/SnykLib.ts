import * as _ from 'lodash';
import { SnykLibInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import {
  EXECUTION_DEBOUNCE_INTERVAL,
  EXECUTION_PAUSE_INTERVAL,
  EXECUTION_THROTTLING_INTERVAL,
} from '../../constants/general';
import { SNYK_CONTEXT, SNYK_MODE_CODES } from '../../constants/views';
import { Logger } from '../../logger';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import { userMe } from '../../services/userService';
import BundlesModule from './BundlesModule';

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
    if (this._mode === SNYK_MODE_CODES.PAUSED) void this.setMode(SNYK_MODE_CODES.AUTO);
  }

  private async startExtension_(manual = false): Promise<void> {
    Logger.info('Starting extension');
    // If the execution is suspended, we only allow user-triggered analyses.
    if (!manual) {
      if ([SNYK_MODE_CODES.MANUAL, SNYK_MODE_CODES.PAUSED].includes(this._mode) || this.shouldBeThrottled()) return;
    }

    await this.setContext(SNYK_CONTEXT.ERROR, false);
    this.resetTransientErrors();
    this.loadingBadge.setLoadingBadge(false, this);

    if (!configuration.token) {
      await this.checkSession();
      return;
    }

    const codeEnabled = await this.checkCodeEnabled();
    await this.setContext(SNYK_CONTEXT.LOGGEDIN, true);

    if (!codeEnabled) {
      return;
    }

    try {
      const user = await userMe();
      if (user) {
        this.analytics.identify(user.id);
      }

      await this.startAnalysis(manual);
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
        this._unpauseTimeout = setTimeout(() => this.unpause(), EXECUTION_PAUSE_INTERVAL);
        break;
      case SNYK_MODE_CODES.AUTO:
      case SNYK_MODE_CODES.MANUAL:
      case SNYK_MODE_CODES.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
      default:
        break;
    }
  }

  async enableCode(): Promise<void> {
    const wasEnabled = await this.snykCode.enable();
    if (wasEnabled) {
      this.loadingBadge.setLoadingBadge(false, this);
      await this.checkCodeEnabled();

      Logger.info('Snyk Code was enabled.');
      await this.startAnalysis(false);
    }
  }

  onDidChangeAnalysisViewVisibility(visible: boolean): void {
    if (visible && !configuration.token) {
      // Track if a user is not authenticated and expanded the analysis view
      this.analytics.logWelcomeViewIsViewed();
    }
  }
}
