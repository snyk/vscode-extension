import { emitter as emitterDC, SupportedFiles } from '@snyk/code-client';
import _ from 'lodash';
import * as vscode from 'vscode';
import { getExtension } from '../../../extension';
import { SNYK_ANALYSIS_STATUS } from '../../common/constants/views';
import { IViewManagerService } from '../../common/services/viewManagerService';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { ISnykCodeService } from '../codeService';
import createFileWatcher from '../watchers/filesWatcher';

export class Progress {
  private emitter = emitterDC;
  private filesWatcher: vscode.FileSystemWatcher;

  constructor(private readonly snykCode: ISnykCodeService, private readonly viewManagerService: IViewManagerService, private readonly workspace: IVSCodeWorkspace) {
  }

  bindListeners(): void {
    this.emitter.on(this.emitter.events.supportedFilesLoaded, this.onSupportedFilesLoaded.bind(this));
    this.emitter.on(this.emitter.events.scanFilesProgress, this.onScanFilesProgress.bind(this));
    this.emitter.on(this.emitter.events.createBundleProgress, this.onCreateBundleProgress.bind(this));
    this.emitter.on(this.emitter.events.uploadBundleProgress, this.onUploadBundleProgress.bind(this));
    this.emitter.on(this.emitter.events.analyseProgress, this.onAnalyseProgress.bind(this));
    this.emitter.on(this.emitter.events.apiRequestLog, Progress.onAPIRequestLog.bind(this));
    this.emitter.on(this.emitter.events.error, this.snykCode.errorEncountered.bind(this));
  }

  updateStatus(status: string, progress: string): void {
    this.snykCode.updateStatus(status, progress);
    this.viewManagerService.refreshAllCodeAnalysisViews();
  }

  onSupportedFilesLoaded(data: SupportedFiles | null): void {
    const msg = data ? 'Ignore rules loading' : 'Loading';

    this.updateStatus(SNYK_ANALYSIS_STATUS.FILTERS, msg);

    // Setup file watcher
    if (!this.filesWatcher && data) {
      this.filesWatcher = createFileWatcher(getExtension(), this.workspace, data);
    }
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

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  static onAPIRequestLog(message: string): void {
    console.log(message);
  }
}
