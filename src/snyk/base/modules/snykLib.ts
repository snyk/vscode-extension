import * as _ from 'lodash';
import { configuration } from '../../common/configuration/instance';
import { DEFAULT_SCAN_DEBOUNCE_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { ErrorHandler } from '../../common/error/errorHandler';
import { Logger } from '../../common/logger/logger';
import { vsCodeCommands } from '../../common/vscode/commands';
import BaseSnykModule from './baseSnykModule';
import { ISnykLib } from './interfaces';
import { FEATURE_FLAGS } from '../../common/constants/featureFlags';

export default class SnykLib extends BaseSnykModule implements ISnykLib {
  private async runFullScan_(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.ERROR, false);
    this.loadingBadge.setLoadingBadge(false);

    const token = await configuration.getToken();
    try {
      if (!token) {
        return;
      }

      Logger.info('Starting full scan');

      await this.contextService.setContext(SNYK_CONTEXT.AUTHENTICATING, false);
      await this.contextService.setContext(SNYK_CONTEXT.LOGGEDIN, true);
      await this.codeSettings.updateIsCodeEnabled();

      if (!configuration.getFeaturesConfiguration()) {
        return;
      }

      await this.user.identify(vsCodeCommands);
    } catch (err) {
      await ErrorHandler.handleGlobal(err, Logger, this.contextService, this.loadingBadge);
    }
  }

  // This function is called by commands, error handlers, etc.
  // We should avoid having duplicate parallel executions.
  public runScan = _.debounce(this.runFullScan_.bind(this), DEFAULT_SCAN_DEBOUNCE_INTERVAL, { leading: true });

  async enableCode(): Promise<void> {
    Logger.info('Enabling Snyk Code');
    const wasEnabled = await this.codeSettings.enable();
    Logger.info(wasEnabled ? 'Snyk Code was enabled' : 'Failed to enable Snyk Code');
  }

  async checkAdvancedMode(): Promise<void> {
    await this.contextService.setContext(SNYK_CONTEXT.ADVANCED, configuration.shouldShowAdvancedView);
  }

  async setupFeatureFlags(): Promise<void> {
    const flags = [
      { flag: FEATURE_FLAGS.consistentIgnores, fallback: false },
      { flag: FEATURE_FLAGS.snykCodeInlineIgnore, fallback: true },
    ];

    const featureFlagResults = await Promise.allSettled(
      flags.map(({ flag, fallback }) => this.fetchFeatureFlagStatus(flag, fallback)),
    );

    const fulfilledResults = featureFlagResults.filter(
      (result): result is PromiseFulfilledResult<{ flag: string; isEnabled: boolean }> => result.status === 'fulfilled',
    );

    fulfilledResults.forEach(({ value }) => {
      const { flag, isEnabled } = value;
      configuration.setFeatureFlag(flag, isEnabled);
      Logger.info(`Feature flag ${flag} is ${isEnabled ? 'enabled' : 'disabled'}`);
    });

    const rejectedResults = featureFlagResults.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    rejectedResults.forEach(({ reason }) => {
      Logger.warn(`Failed to fetch feature flag: ${reason}`);
    });
  }

  private async fetchFeatureFlagStatus(flag: string, fallback: boolean): Promise<{ flag: string; isEnabled: boolean }> {
    const isEnabled = await this.featureFlagService.fetchFeatureFlag(flag, fallback);
    return { flag, isEnabled };
  }

  protected async setWorkspaceContext(workspacePaths: string[]): Promise<void> {
    const workspaceFound = !!workspacePaths.length;
    await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, workspaceFound);
  }
}
