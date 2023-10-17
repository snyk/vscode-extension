import * as _ from 'lodash';
import { firstValueFrom } from 'rxjs';
import { CliError } from '../../cli/services/cliService';
import { SupportedAnalysisProperties } from '../../common/analytics/itly';
import { configuration } from '../../common/configuration/instance';
import { DEFAULT_SCAN_DEBOUNCE_INTERVAL, IDE_NAME, OSS_SCAN_DEBOUNCE_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ErrorHandler } from '../../common/error/errorHandler';
import { Logger } from '../../common/logger/logger';
import { vsCodeCommands } from '../../common/vscode/commands';
import { vsCodeWorkspace } from '../../common/vscode/workspace';
import BaseSnykModule from './baseSnykModule';
import { ISnykLib } from './interfaces';

export default class SnykLib extends BaseSnykModule implements ISnykLib {
  private async runFullScan_(manual = false): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.ERROR, false);
    this.loadingBadge.setLoadingBadge(false);

    const token = await configuration.getToken();
    try {
      if (!token) {
        return;
      }

      // Only starts OSS scan. Code & IaC scans are managed by LS
      Logger.info('Starting full scan');

      await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, false);
      await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
      await this.codeSettings.updateIsCodeEnabled();

      if (!configuration.getFeaturesConfiguration()) {
        return;
      }

      await this.user.identify(vsCodeCommands, this.analytics);

      const workspacePaths = vsCodeWorkspace.getWorkspaceFolders();
      if (workspacePaths.length) {
        this.logFullAnalysisIsTriggered(manual);
        void this.startOssAnalysis(manual, false);
      }
    } catch (err) {
      await ErrorHandler.handleGlobal(err, Logger, this.contextService, this.loadingBadge);
    }
  }

  // This function is called by commands, error handlers, etc.
  // We should avoid having duplicate parallel executions.
  // Only starts OSS scan. Code & IaC scans are managed by LS
  public runScan = _.debounce(this.runFullScan_.bind(this), DEFAULT_SCAN_DEBOUNCE_INTERVAL, { leading: true });

  public runOssScan = _.debounce(this.startOssAnalysis.bind(this), OSS_SCAN_DEBOUNCE_INTERVAL, { leading: true });

  async enableCode(): Promise<void> {
    Logger.info('Enabling Snyk Code');
    const wasEnabled = await this.codeSettings.enable();
    Logger.info(wasEnabled ? 'Snyk Code was enabled' : 'Failed to enable Snyk Code');
  }

  async onDidChangeWelcomeViewVisibility(visible: boolean): Promise<void> {
    if (visible && !(await configuration.getToken())) {
      // Track if a user is not authenticated and expanded the analysis view
      this.analytics.logWelcomeViewIsViewed();
    }
  }

  onDidChangeOssTreeVisibility(visible: boolean): void {
    if (this.ossService) {
      this.ossService.setVulnerabilityTreeVisibility(visible);
    }
  }

  async checkAdvancedMode(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.ADVANCED, configuration.shouldShowAdvancedView);
  }

  protected async setWorkspaceContext(workspacePaths: string[]): Promise<void> {
    const workspaceFound = !!workspacePaths.length;
    await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, workspaceFound);
  }

  private async startOssAnalysis(manual = false, reportTriggeredEvent = true): Promise<void> {
    if (!configuration.getFeaturesConfiguration()?.ossEnabled) return;
    if (!this.ossService) throw new Error('OSS service is not initialized.');

    // wait until Snyk Language Server is downloaded
    await firstValueFrom(this.downloadService.downloadReady$);

    try {
      const result = await this.ossService.test(manual, reportTriggeredEvent);

      if (result instanceof CliError || !result) {
        return;
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

    if (analysisType.length) {
      this.analytics.logAnalysisIsTriggered({
        analysisType: analysisType as [SupportedAnalysisProperties, ...SupportedAnalysisProperties[]],
        ide: IDE_NAME,
        triggeredByUser: manual,
      });
    }
  }
}
