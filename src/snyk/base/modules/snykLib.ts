import * as _ from 'lodash';
import { firstValueFrom } from 'rxjs';
import * as vscode from 'vscode';
import { CliError } from '../../cli/services/cliService';
import { analytics } from '../../common/analytics/analytics';
import { configuration } from '../../common/configuration/instance';
import { EXECUTION_DEBOUNCE_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { Logger } from '../../common/logger/logger';
import { errorsLogs } from '../../common/messages/errorsServerLogMessages';
import { INotificationService } from '../../common/services/notificationService';
import { userMe } from '../../common/services/userService';
import { messages as ossTestMessages } from '../../snykOss/messages/test';
import { snykMessages } from '../messages/snykMessages';
import { ISnykLib } from './interfaces';
import LoginModule from './loginModule';

export default class SnykLib extends LoginModule implements ISnykLib {
  private async runFullScan_(manual = false): Promise<void> {
    Logger.info('Starting full scan');
    // If the execution is suspended, we only allow user-triggered analyses.
    if (!manual && !this.scanModeService.isAutoScanAllowed()) {
      return;
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

      void this.runOssScan(manual);
      await this.runCodeScan(manual); // mark void, handle errors inside of startSnykCodeAnalysis()
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedExecutionDebounce,
      });
    }
  }

  // This function is called by commands, error handlers, etc.
  // We should avoid having duplicate parallel executions.
  public runScan = _.debounce(this.runFullScan_.bind(this), EXECUTION_DEBOUNCE_INTERVAL, { leading: true });

  public runCodeScan = _.debounce(this.startSnykCodeAnalysis.bind(this), EXECUTION_DEBOUNCE_INTERVAL, {
    leading: true,
  });

  public runOssScan = _.debounce(this.startOssAnalysis.bind(this), EXECUTION_DEBOUNCE_INTERVAL, { leading: true });

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

  async startSnykCodeAnalysis(manual = false): Promise<void> {
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

  onDidChangeOssTreeVisibility(visible: boolean): void {
    if (this.ossService) {
      this.ossService.setVulnerabilityTreeVisibility(visible);
    }
  }

  private async startOssAnalysis(_manual = false): Promise<void> {
    if (!this.ossService) throw new Error('OSS service is not initialized.');

    // wait until Snyk CLI is downloaded
    await firstValueFrom(this.cliDownloadService.downloadFinished$);

    try {
      const oldResult = this.ossService.getResult();
      const result = await this.ossService.test();
      if (result instanceof CliError) {
        reportError(this.notificationService);
      } else if (oldResult) {
        await this.ossService.showBackgroundNotification(oldResult);
      }
    } catch (err) {
      // catch unhandled error cases by reporting test failure
      this.ossService.finalizeTest();
      Logger.error(`${ossTestMessages.testFailed} ${err}`);
      reportError(this.notificationService);
    }

    function reportError(notificationService: INotificationService) {
      void notificationService.showErrorNotification(`${ossTestMessages.testFailed} ${snykMessages.errorQuery}`);
    }
  }
}
