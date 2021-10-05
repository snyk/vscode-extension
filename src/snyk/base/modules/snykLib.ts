import * as _ from 'lodash';
import { firstValueFrom } from 'rxjs';
import * as vscode from 'vscode';
import { CliError } from '../../cli/services/cliService';
import { analytics } from '../../common/analytics/analytics';
import { SupportedAnalysisProperties } from '../../common/analytics/itly';
import { configuration } from '../../common/configuration/instance';
import { DEFAULT_SCAN_DEBOUNCE_INTERVAL, IDE_NAME, OSS_SCAN_DEBOUNCE_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { Logger } from '../../common/logger/logger';
import { errorsLogs } from '../../common/messages/errorsServerLogMessages';
import { userMe } from '../../common/services/userService';
import { ISnykLib } from './interfaces';
import LoginModule from './loginModule';

export default class SnykLib extends LoginModule implements ISnykLib {
  private async runFullScan_(manual = false): Promise<void> {
    Logger.info('Starting full scan');

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

      const paths = await this.getWorkspacePaths();
      if (paths.length) {
        this.logFullAnalysisIsTriggered(manual);

        void this.startOssAnalysis(manual, false);
        await this.startSnykCodeAnalysis(paths, manual, false); // mark void, handle errors inside of startSnykCodeAnalysis()
      }
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedExecutionDebounce,
      });
    }
  }

  // This function is called by commands, error handlers, etc.
  // We should avoid having duplicate parallel executions.
  public runScan = _.debounce(this.runFullScan_.bind(this), DEFAULT_SCAN_DEBOUNCE_INTERVAL, { leading: true });

  public runCodeScan = _.debounce(this.startSnykCodeAnalysis.bind(this), DEFAULT_SCAN_DEBOUNCE_INTERVAL, {
    leading: true,
  });

  public runOssScan = _.debounce(this.startOssAnalysis.bind(this), OSS_SCAN_DEBOUNCE_INTERVAL, { leading: true });

  async enableCode(): Promise<void> {
    const wasEnabled = await this.snykCode.enable();
    if (wasEnabled) {
      this.loadingBadge.setLoadingBadge(false, this);
      await this.checkCodeEnabled();

      Logger.info('Snyk Code was enabled.');
      try {
        await this.startSnykCodeAnalysis();
      } catch (err) {
        await this.processError(err);
      }
    }
  }

  async startSnykCodeAnalysis(paths: string[] = [], manual = false, reportTriggeredEvent = true): Promise<void> {
    // If the execution is suspended, we only allow user-triggered Snyk Code analyses.
    if (this.isSnykCodeAutoscanSuspended(manual)) {
      return;
    }

    if (!paths.length) {
      paths = await this.getWorkspacePaths();
    }

    await this.snykCode.startAnalysis(paths, manual, reportTriggeredEvent);
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

  private async getWorkspacePaths(): Promise<string[]> {
    const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath); // todo: work with workspace class as abstraction
    if (paths.length) {
      await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, true);
    } else {
      await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, false);
    }

    return paths;
  }

  private async startOssAnalysis(manual = false, reportTriggeredEvent = true): Promise<void> {
    if (!configuration.getFeaturesConfiguration()?.ossEnabled) return;
    if (!this.ossService) throw new Error('OSS service is not initialized.');

    // wait until Snyk CLI is downloaded
    await firstValueFrom(this.cliDownloadService.downloadFinished$);

    try {
      const oldResult = this.ossService.getResult();
      const result = await this.ossService.test(manual, reportTriggeredEvent);
      if (result instanceof CliError) {
        return;
      }

      if (oldResult) {
        await this.ossService.showBackgroundNotification(oldResult);
      }
    } catch (err) {
      // catch unhandled error cases by reporting test failure
      this.ossService.finalizeTest(new CliError(err));
    }
  }

  private isSnykCodeAutoscanSuspended(manual: boolean) {
    return !manual && !this.scanModeService.isCodeAutoScanAllowed();
  }

  private logFullAnalysisIsTriggered(manual: boolean) {
    const analysisType: SupportedAnalysisProperties[] = [];

    const enabledFeatures = configuration.getFeaturesConfiguration();

    // Ensure preconditions are the same as within running specific analysis
    if (!this.isSnykCodeAutoscanSuspended(manual)) {
      if (enabledFeatures?.codeSecurityEnabled) analysisType.push('Snyk Code Security');
      if (enabledFeatures?.codeQualityEnabled) analysisType.push('Snyk Code Quality');
    }
    if (enabledFeatures?.ossEnabled) analysisType.push('Snyk Open Source');

    analytics.logAnalysisIsTriggered({
      analysisType,
      ide: IDE_NAME,
      triggeredByUser: manual,
    });
  }
}
