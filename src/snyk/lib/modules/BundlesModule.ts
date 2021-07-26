import { analyzeFolders, constants, extendAnalysis } from '@snyk/code-client';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import { BundlesModuleInterface } from '../../../interfaces/SnykInterfaces';
import { SupportedAnalysisProperties } from '../../analytics/itly';
import { configuration } from '../../configuration';
import { SNYK_ANALYSIS_STATUS, SNYK_CONTEXT } from '../../constants/views';
import { Logger } from '../../logger';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import LoginModule from './LoginModule';

abstract class BundlesModule extends LoginModule implements BundlesModuleInterface {
  files: string[] = [];

  updateStatus(status: string, progress: string): void {
    this.snykCode.updateStatus(status, progress);
    this.viewManagerService.refreshAllAnalysisViews();
  }

  onScanFilesProgress(value: number): void {
    this.updateStatus(SNYK_ANALYSIS_STATUS.COLLECTING, `${value}`);
  }

  onCreateBundleProgress(processed: number, total: number): void {
    this.updateStatus(SNYK_ANALYSIS_STATUS.BUNDLING, `${processed}/${total}`);
  }

  onUploadBundleProgress(processed: number, total: number): void {
    this.updateStatus(SNYK_ANALYSIS_STATUS.UPLOADING, `${processed}/${total}`);
  }

  onAnalyseProgress(data: { status: string; progress: number }): void {
    this.updateStatus(_.capitalize(_.toLower(data.status)), `${Math.round(100 * data.progress)}%`);
  }

  static onAPIRequestLog(message: string): void {
    console.log(message);
  }

  onError(error: Error): void {
    this.snykCode.stopAnalysis();
    // no need to wait for processError since onError is called asynchronously as well
    void this.processError(error, {
      message: errorsLogs.failedServiceAI,
    });
  }

  // todo: refactor code to SnykCode/SAST class
  public async startAnalysis(manual: boolean): Promise<void> {
    if (this.snykCode.isAnalysisRunning) {
      return;
    }

    const enabledFeatures = configuration.getFeaturesConfiguration();

    try {
      const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);

      if (paths.length) {
        Logger.info('Code analysis started.');

        const analysisType: SupportedAnalysisProperties[] = [];
        if (enabledFeatures?.codeSecurityEnabled) analysisType.push('Snyk Code Security');
        if (enabledFeatures?.codeQualityEnabled) analysisType.push('Snyk Code Quality');

        this.analytics.logAnalysisIsTriggered({
          analysisType,
          ide: 'Visual Studio Code',
          triggeredByUser: manual,
        });

        await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, true);
        this.snykCode.startAnalysis();

        let result;
        if (this.changedFiles.size && this.remoteBundle) {
          const changedFiles = [...this.changedFiles];
          this.changedFiles.clear();
          result = await extendAnalysis(this.remoteBundle, changedFiles, constants.MAX_PAYLOAD, configuration.source);
        } else {
          result = await analyzeFolders({
            baseURL: configuration.baseURL,
            sessionToken: configuration.token ?? '', // todo: handle the case appropriately
            paths,
            source: configuration.source,
          });
        }

        if (result) {
          this.remoteBundle = result;

          this.analyzer.analysisResults = result.analysisResults;
          this.analyzer.createReviewResults();

          Logger.info('Code analysis finished.');

          if (enabledFeatures?.codeSecurityEnabled) {
            this.analytics.logAnalysisIsReady({
              ide: 'Visual Studio Code',
              analysisType: 'Snyk Code Security',
              result: 'Success',
            });
          }
          if (enabledFeatures?.codeQualityEnabled) {
            this.analytics.logAnalysisIsReady({
              ide: 'Visual Studio Code',
              analysisType: 'Snyk Code Quality',
              result: 'Success',
            });
          }

          this.viewManagerService.refreshFeatureAnalysisViews(enabledFeatures);
          this.suggestionProvider.checkCurrentSuggestion();
        }
      } else {
        await this.contextService.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, false);
      }
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedAnalysis,
      });
      if (enabledFeatures?.codeSecurityEnabled) {
        this.analytics.logAnalysisIsReady({
          ide: 'Visual Studio Code',
          analysisType: 'Snyk Code Security',
          result: 'Error',
        });
      }
      if (enabledFeatures?.codeQualityEnabled) {
        this.analytics.logAnalysisIsReady({
          ide: 'Visual Studio Code',
          analysisType: 'Snyk Code Quality',
          result: 'Error',
        });
      }

      Logger.info('Code analysis failed.');
    } finally {
      this.snykCode.finaliseAnalysis();
    }
  }
}

export default BundlesModule;
