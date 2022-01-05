import * as vscode from 'vscode';
import { IExtension } from '../../base/modules/interfaces';
import { IAnalytics } from '../analytics/itly';
import { configuration } from '../configuration/instance';
import {
  ADVANCED_ADVANCED_MODE_SETTING,
  ADVANCED_AUTOSCAN_OSS_SETTING,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  OSS_ENABLED_SETTING,
  SEVERITY_FILTER_SETTING,
  TOKEN_SETTING,
  YES_TELEMETRY_SETTING,
} from '../constants/settings';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { errorsLogs } from '../messages/errors';
import { IWatcher } from './interfaces';

class SettingsWatcher implements IWatcher {
  constructor(private readonly analytics: IAnalytics, private readonly logger: ILog) {}

  private async onChangeConfiguration(extension: IExtension, key: string): Promise<void> {
    if (key === ADVANCED_ADVANCED_MODE_SETTING) {
      return extension.checkAdvancedMode();
    } else if (key === YES_TELEMETRY_SETTING) {
      return await this.analytics.setShouldReportEvents(configuration.shouldReportEvents);
    } else if (key === OSS_ENABLED_SETTING) {
      extension.viewManagerService.refreshOssView();
    } else if (key === CODE_SECURITY_ENABLED_SETTING || key === CODE_QUALITY_ENABLED_SETTING) {
      // If two settings are changed simultaneously, only one will be applied, thus refresh all views
      extension.viewManagerService.refreshAllCodeAnalysisViews();
    } else if (key === SEVERITY_FILTER_SETTING) {
      return extension.viewManagerService.refreshAllViews();
    }

    const extensionConfig = vscode.workspace.getConfiguration('snyk');
    const url: string | undefined = extensionConfig.get('url');

    const cleaned = url?.replace(/\/$/, '');
    if (cleaned !== url) {
      void extensionConfig.update('url', cleaned, true);
    }

    return extension.runScan();
  }

  public activate(extension: IExtension): void {
    vscode.workspace.onDidChangeConfiguration(
      async (event: vscode.ConfigurationChangeEvent): Promise<void> => {
        const change = [
          TOKEN_SETTING,
          ADVANCED_ADVANCED_MODE_SETTING,
          ADVANCED_AUTOSCAN_OSS_SETTING,
          YES_TELEMETRY_SETTING,
          OSS_ENABLED_SETTING,
          CODE_SECURITY_ENABLED_SETTING,
          CODE_QUALITY_ENABLED_SETTING,
          SEVERITY_FILTER_SETTING,
        ].find(config => event.affectsConfiguration(config));
        if (change) {
          try {
            await this.onChangeConfiguration(extension, change);
          } catch (error) {
            ErrorHandler.handle(
              error,
              this.logger,
              `${errorsLogs.configWatcher}. Configuration key: ${change}`,
            );
          }
        }
      },
    );
  }
}

export default SettingsWatcher;
