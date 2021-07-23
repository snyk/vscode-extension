import * as vscode from 'vscode';
import { ExtensionInterface, SnykWatcherInterface } from '../../../interfaces/SnykInterfaces';
import {
  ADVANCED_ADVANCED_MODE_SETTING,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  TOKEN_SETTING,
  YES_TELEMETRY_SETTING,
} from '../../constants/settings';
import { configuration } from '../../configuration';
import { errorsLogs } from '../../messages/errorsServerLogMessages';

class SnykSettingsWatcher implements SnykWatcherInterface {
  private async onChangeConfiguration(extension: ExtensionInterface, key: string): Promise<void> {
    if (key === ADVANCED_ADVANCED_MODE_SETTING) {
      return extension.checkAdvancedMode();
    } else if (key === YES_TELEMETRY_SETTING) {
      return extension.analytics.setShouldReportEvents(configuration.shouldReportEvents);
    } else if (key === CODE_SECURITY_ENABLED_SETTING || key === CODE_QUALITY_ENABLED_SETTING) {
      // If two settings are changed simultaneously, only one will be applied, thus refresh all views
      extension.viewManagerService.refreshAllAnalysisViews();
    }

    const extensionConfig = vscode.workspace.getConfiguration('snyk');
    const url: string | undefined = extensionConfig.get('url');

    const cleaned = url?.replace(/\/$/, '');
    if (cleaned !== url) {
      void extensionConfig.update('url', cleaned, true);
    }

    return extension.startExtension();
  }

  public activate(extension: ExtensionInterface): void {
    vscode.workspace.onDidChangeConfiguration(
      async (event: vscode.ConfigurationChangeEvent): Promise<void> => {
        const change = [
          TOKEN_SETTING,
          ADVANCED_ADVANCED_MODE_SETTING,
          YES_TELEMETRY_SETTING,
          CODE_SECURITY_ENABLED_SETTING,
          CODE_QUALITY_ENABLED_SETTING,
        ].find(config => event.affectsConfiguration(config));
        if (change) {
          try {
            await this.onChangeConfiguration(extension, change);
          } catch (error) {
            await extension.processError(error, {
              message: errorsLogs.configWatcher,
              data: {
                configurationKey: change,
              },
            });
          }
        }
      },
    );
  }
}

export default SnykSettingsWatcher;
