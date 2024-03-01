import * as _ from 'lodash';
import * as vscode from 'vscode';
import { IExtension } from '../../base/modules/interfaces';
import { configuration } from '../configuration/instance';
import { DEFAULT_LS_DEBOUNCE_INTERVAL, SNYK_TOKEN_KEY } from '../constants/general';
import {
  ADVANCED_ADVANCED_MODE_SETTING,
  ADVANCED_AUTOSCAN_OSS_SETTING,
  ADVANCED_CUSTOM_ENDPOINT,
  ADVANCED_CUSTOM_LS_PATH,
  CODE_QUALITY_ENABLED_SETTING,
  CODE_SECURITY_ENABLED_SETTING,
  IAC_ENABLED_SETTING,
  OSS_ENABLED_SETTING,
  SEVERITY_FILTER_SETTING,
  TRUSTED_FOLDERS,
} from '../constants/settings';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { errorsLogs } from '../messages/errors';
import SecretStorageAdapter from '../vscode/secretStorage';
import { IWatcher } from './interfaces';

class ConfigurationWatcher implements IWatcher {
  constructor(private readonly logger: ILog) {}

  private async onChangeConfiguration(extension: IExtension, key: string): Promise<void> {
    if (key === ADVANCED_ADVANCED_MODE_SETTING) {
      return extension.checkAdvancedMode();
    } else if (key === OSS_ENABLED_SETTING) {
      extension.viewManagerService.refreshOssView();
    } else if (key === CODE_SECURITY_ENABLED_SETTING || key === CODE_QUALITY_ENABLED_SETTING) {
      return extension.viewManagerService.refreshAllCodeAnalysisViews();
    } else if (key === IAC_ENABLED_SETTING) {
      return extension.viewManagerService.refreshIacView();
    } else if (key === SEVERITY_FILTER_SETTING) {
      return extension.viewManagerService.refreshAllViews();
    } else if (key === ADVANCED_CUSTOM_ENDPOINT) {
      return configuration.clearToken();
    } else if (key === ADVANCED_CUSTOM_LS_PATH) {
      // Language Server client must sync config changes before we can restart
      return _.debounce(() => extension.restartLanguageServer(), DEFAULT_LS_DEBOUNCE_INTERVAL)();
    } else if (key === TRUSTED_FOLDERS) {
      extension.workspaceTrust.resetTrustedFoldersCache();
      extension.viewManagerService.refreshAllViews();
    }

    // from here on only for OSS and trusted folders

    const extensionConfig = vscode.workspace.getConfiguration('snyk');
    const url: string | undefined = extensionConfig.get('url');

    const cleaned = url?.replace(/\/$/, '');
    if (cleaned !== url) {
      void extensionConfig.update('url', cleaned, true);
    }

    return extension.runScan();
  }

  public activate(extension: IExtension): void {
    vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent): Promise<void> => {
      const change = [
        ADVANCED_ADVANCED_MODE_SETTING,
        ADVANCED_AUTOSCAN_OSS_SETTING,
        OSS_ENABLED_SETTING,
        CODE_SECURITY_ENABLED_SETTING,
        CODE_QUALITY_ENABLED_SETTING,
        IAC_ENABLED_SETTING,
        SEVERITY_FILTER_SETTING,
        ADVANCED_CUSTOM_ENDPOINT,
        ADVANCED_CUSTOM_LS_PATH,
        TRUSTED_FOLDERS,
      ].find(config => event.affectsConfiguration(config));

      if (change) {
        try {
          await this.onChangeConfiguration(extension, change);
        } catch (error) {
          ErrorHandler.handle(error, this.logger, `${errorsLogs.configWatcher}. Configuration key: ${change}`);
        }
      }
    });

    SecretStorageAdapter.instance.onDidChange(event => {
      if (event.key === SNYK_TOKEN_KEY) {
        return extension.runScan();
      }
    });
  }
}

export default ConfigurationWatcher;
