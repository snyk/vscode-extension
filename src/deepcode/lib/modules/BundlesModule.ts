import * as vscode from "vscode";

import { BundlesModuleInterface } from "../../../interfaces/DeepCodeInterfaces";

import LoginModule from "../../lib/modules/LoginModule";
import { DEEPCODE_ANALYSIS_STATUS, DEEPCODE_CONTEXT } from "../../constants/views";
import { errorsLogs } from '../../messages/errorsServerLogMessages';

import { analyzeFolders, extendAnalysis } from '@deepcode/tsc';

abstract class BundlesModule extends LoginModule implements BundlesModuleInterface {
  runningAnalysis = false;

  files: string[] = [];

  updateStatus(status: string, progress: string) {
    this.analysisStatus = status;
    this.analysisProgress = progress;
    this.refreshViews();
  }

  onScanFilesProgress(value: number) {
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.COLLECTING, `${value}`);
  }

  onCreateBundleProgress(processed: number, total: number) {
    // console.log(`BUNDLE PROGRESS - ${processed}/${total}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.BUNDLING, `${processed}/${total}`);
  }

  onUploadBundleProgress(processed: number, total: number) {
    // console.log(`UPLOAD BUNDLE PROGRESS - ${processed}/${total}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.UPLOADING, `${processed}/${total}`);
  }

  onAnalyseProgress(data: { status: string; progress: number }) {
    // console.log(`ANALYSE PROGRESS - ${data.progress}`);
    this.updateStatus(DEEPCODE_ANALYSIS_STATUS.ANALYZING, `${Math.round(100 * data.progress)}%`);
  }

  onError(error: Error) {
    this.runningAnalysis = false;
    // no need to wait for processError since onError is called asynchronously as well
    this.processError(error, {
      message: errorsLogs.failedServiceAI,
    });
  }

  public async startAnalysis(): Promise<void> {
    try {
      const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);

      if (paths.length) {
        await this.setContext(DEEPCODE_CONTEXT.WORKSPACE_FOUND, true);

        if (this.runningAnalysis) {
          return;
        }
        this.runningAnalysis = true;

        let result;
        if (this.changedFiles.size && this.remoteBundle) {
          const changedFiles = [...this.changedFiles];
          this.changedFiles.clear();
          result = await extendAnalysis(this.remoteBundle, changedFiles);
        } else {
          result = await analyzeFolders(this.baseURL, this.token, false, 1, paths);
        }

        if (result) {
          this.remoteBundle = result;

          this.analyzer.analysisResults = result.analysisResults;
          this.analyzer.createReviewResults();

          this.refreshViews();
          this.suggestionProvider.checkCurrentSuggestion();
        }
      } else {
        await this.setContext(DEEPCODE_CONTEXT.WORKSPACE_FOUND, false);
      }
    } catch (err) {
      await this.processError(err, {
        message: errorsLogs.failedAnalysis,
      });
    } finally {
      this.runningAnalysis = false;
    }
  }
}

export default BundlesModule;
