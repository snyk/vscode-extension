import * as vscode from "vscode";
import * as _ from "lodash";

import { BundlesModuleInterface } from "../../../interfaces/SnykInterfaces";

import LoginModule from "../../lib/modules/LoginModule";
import { SNYK_ANALYSIS_STATUS, SNYK_CONTEXT } from "../../constants/views";
import { errorsLogs } from '../../messages/errorsServerLogMessages';

import { analyzeFolders, extendAnalysis, constants } from '@snyk/code-client';

abstract class BundlesModule extends LoginModule implements BundlesModuleInterface {
  runningAnalysis = false;

  private lastAnalysisStartingTimestamp = Date.now();
  lastAnalysisDuration = 0;
  lastAnalysisTimestamp = Date.now();

  files: string[] = [];

  updateStatus(status: string, progress: string) {
    this.analysisStatus = status;
    this.analysisProgress = progress;
    this.refreshViews();
  }

  onScanFilesProgress(value: number) {
    this.updateStatus(SNYK_ANALYSIS_STATUS.COLLECTING, `${value}`);
  }

  onCreateBundleProgress(processed: number, total: number) {
    this.updateStatus(SNYK_ANALYSIS_STATUS.BUNDLING, `${processed}/${total}`);
  }

  onUploadBundleProgress(processed: number, total: number) {
    this.updateStatus(SNYK_ANALYSIS_STATUS.UPLOADING, `${processed}/${total}`);
  }

  onAnalyseProgress(data: { status: string; progress: number }) {
    this.updateStatus(_.capitalize(_.toLower(data.status)), `${Math.round(100 * data.progress)}%`);
  }

  onAPIRequestLog(message: string) {
    console.log(message);
  }

  onError(error: Error) {
    this.runningAnalysis = false;
    // no need to wait for processError since onError is called asynchronously as well
    this.processError(error, {
      message: errorsLogs.failedServiceAI,
    });
  }

  public async startAnalysis(): Promise<void> {
    if (this.runningAnalysis) {
      return;
    }
    try {
      const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);

      if (paths.length) {
        await this.setContext(SNYK_CONTEXT.WORKSPACE_FOUND, true);
        this.runningAnalysis = true;
        this.lastAnalysisStartingTimestamp = Date.now();

        let result;
        if (this.changedFiles.size && this.remoteBundle) {
          const changedFiles = [...this.changedFiles];
          this.changedFiles.clear();
          result = await extendAnalysis(this.remoteBundle, changedFiles, constants.MAX_PAYLOAD, this.source);
        } else {
          result = await analyzeFolders({ baseURL: this.baseURL, sessionToken: this.token, paths, source: this.source });
        }

        if (result) {
          this.remoteBundle = result;

          this.analyzer.analysisResults = result.analysisResults;
          this.analyzer.createReviewResults();

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
