import * as vscode from 'vscode';
import { BaseSnykModuleInterface } from '../../interfaces/SnykInterfaces';
import { SNYK_VIEW_WELCOME } from '../constants/views';
import { errorsLogs } from '../messages/errorsServerLogMessages';
import { IViewManagerService } from '../services/viewManagerService';
import { PendingTask, PendingTaskInterface } from '../utils/pendingTask';

export interface ILoadingBadge {
  setLoadingBadge(value: boolean, reportModule: BaseSnykModuleInterface): void;
}

export class LoadingBadge implements ILoadingBadge {
  private progressBadge: PendingTaskInterface | undefined;
  private shouldShowProgressBadge = false;

  constructor(private viewManagerService: IViewManagerService) {}

  private getProgressBadgePromise(): Promise<void> {
    if (!this.shouldShowProgressBadge) return Promise.resolve();
    if (!this.progressBadge || this.progressBadge.isCompleted) {
      this.progressBadge = new PendingTask();
    }
    return this.progressBadge.waiter;
  }

  // Leave viewId undefined to remove the badge from all views
  setLoadingBadge(value: boolean, reportModule: BaseSnykModuleInterface): void {
    this.shouldShowProgressBadge = value;
    if (value) {
      // Using closure on this to allow partial binding in arbitrary positions
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      this.viewManagerService.initializedView.waiter
        .then(
          () =>
            vscode.window.withProgress({ location: { viewId: SNYK_VIEW_WELCOME } }, () =>
              self.getProgressBadgePromise(),
            ), // todo check if correct with respect to security/quality split
        )
        .then(
          () => undefined,
          error =>
            reportModule.processError(error, {
              message: errorsLogs.loadingBadge,
            }),
        );
    } else if (this.progressBadge && !this.progressBadge.isCompleted) {
      this.progressBadge.complete();
    }
  }
}
