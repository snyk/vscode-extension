import { analyzeFolders, constants, extendAnalysis } from '@snyk/code-client';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import { BundlesModuleInterface } from '../../../interfaces/SnykInterfaces';
import { configuration } from '../../configuration';
import { SNYK_ANALYSIS_STATUS, SNYK_CONTEXT } from '../../constants/views';
import { errorsLogs } from '../../messages/errorsServerLogMessages';
import LoginModule from './LoginModule';

abstract class BundlesModule extends LoginModule implements BundlesModuleInterface {
  runningAnalysis = false;

  private lastAnalysisStartingTimestamp = Date.now();
  lastAnalysisDuration = 0;
  lastAnalysisTimestamp = Date.now();

  files: string[] = [];

  updateStatus(status: string, progress: string): void {
    this.analysisStatus = status;
    this.analysisProgress = progress;
    this.refreshViews();
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
    this.runningAnalysis = false;
    // no need to wait for processError since onError is called asynchronously as well
    void this.processError(error, {
      message: errorsLogs.failedServiceAI,
    });
  }

  public async startAnalysis(): Promise<void> {
    if (this.runningAnalysis) {
      return;
    }
    try {
      const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);

      this.analytics.logEvent('Analysis Is Triggered', {
        analysisType: 'Code Security',
        ide: 'Visual Studio Code',
        userId: this.userId,
      });

      if (paths.length) {
        await this.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, true);
        this.runningAnalysis = true;
        this.lastAnalysisStartingTimestamp = Date.now();

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

          this.analytics.logEvent('Analysis Is Ready', {
            ide: 'Visual Studio Code',
            product: 'Snyk Code',
            type: 'Security vulnerabilities',
            userId: this.userId,
          });

          this.refreshViews();
          this.suggestionProvider.checkCurrentSuggestion();
        }
      } else {
        await this.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, false);
      }
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedAnalysis,
      });
    } finally {
      this.runningAnalysis = false;
      this.lastAnalysisTimestamp = Date.now();
      this.lastAnalysisDuration = this.lastAnalysisTimestamp - this.lastAnalysisStartingTimestamp;
    }
  }
}

export default BundlesModule;
