import * as _ from 'lodash';
import {
  EXECUTION_DEBOUNCE_INTERVAL,
  EXECUTION_PAUSE_INTERVAL,
  EXECUTION_THROTTLING_INTERVAL,
} from '../../common/constants/general';
import { SNYK_CONTEXT, SNYK_MODE_CODES } from '../../common/constants/views';
import { Logger } from '../../common/logger/logger';
import { errorsLogs } from '../../common/messages/errorsServerLogMessages';
import { userMe } from '../../common/services/userService';
import * as vscode from 'vscode';
import LoginModule from './loginModule';
import { analytics } from '../../common/analytics/analytics';
import { ISnykLib } from './interfaces';
import { configuration } from '../../common/configuration/instance';
import { NotificationService } from '../../common/services/notificationService';
import { snykMessages } from '../messages/snykMessages';
import { OssService } from '../../snykOss/services/ossService';
import { vsCodeWorkspace } from '../../common/vscode/workspace';
import { messages as ossTestMessages } from '../../snykOss/messages/test';
import { CliError } from '../../cli/services/cliService';

export default class SnykLib extends LoginModule implements ISnykLib {
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

    await this.contextService.setContext(SNYK_CONTEXT.ERROR, false);
    this.resetTransientErrors();
    this.loadingBadge.setLoadingBadge(false, this);

    if (!configuration.token) {
      await this.checkSession();
      return;
    }

    await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, false);
    await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);

    if (!configuration.getFeaturesConfiguration()) {
      await this.contextService.setContext(SNYK_CONTEXT.FEATURES_SELECTED, false);
      return;
    }

    await this.contextService.setContext(SNYK_CONTEXT.FEATURES_SELECTED, true);

    const codeEnabled = await this.checkCodeEnabled();
    if (!codeEnabled) {
      return;
    }

    try {
      const user = await userMe();
      if (user) {
        analytics.identify(user.id);
      }

      this.cliDownloadService.downloadFinished$.subscribe(() => {
        void this.startOssAnalysis();
      });

      await this.startSnykCodeAnalysis(manual);
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
    await this.contextService.setContext(SNYK_CONTEXT.MODE, mode);
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
      try {
        await this.startSnykCodeAnalysis(false);
      } catch (err) {
        await this.processError(err);
      }
    }
  }

  async startSnykCodeAnalysis(manual: boolean): Promise<void> {
    const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath); // todo: work with workspace class as abstraction

    if (paths.length) {
      await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, true);

      await this.snykCode.startAnalysis(paths, manual);
    } else {
      await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, false);
    }
  }

  onDidChangeWelcomeViewVisibility(visible: boolean): void {
    if (visible && !configuration.token) {
      // Track if a user is not authenticated and expanded the analysis view
      analytics.logWelcomeViewIsViewed();
    }
  }

  private async startOssAnalysis(): Promise<void> {
    if (!this.ossService) throw new Error('OSS service is not initialized.');

    const result = await this.ossService.test(); // TODO: do not run on all file saves
    if (result instanceof CliError) {
      void NotificationService.showErrorNotification(`${ossTestMessages.testFailed} ${snykMessages.errorQuery}`);
    }
  }
}
