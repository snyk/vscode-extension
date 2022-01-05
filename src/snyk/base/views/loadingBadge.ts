import * as vscode from 'vscode';
import { SNYK_VIEW_WELCOME } from '../../common/constants/views';
import { ErrorReporter } from '../../common/error/errorReporter';
import { IPendingTask, PendingTask } from '../pendingTask';

export interface ILoadingBadge {
  setLoadingBadge(value: boolean): void;
}

export class LoadingBadge implements ILoadingBadge {
  private progressBadge: IPendingTask | undefined;
  private shouldShowProgressBadge = false;

  private getProgressBadgePromise(): Promise<void> {
    if (!this.shouldShowProgressBadge) return Promise.resolve();
    if (!this.progressBadge || this.progressBadge.isCompleted) {
      this.progressBadge = new PendingTask();
    }
    return this.progressBadge.waiter;
  }

  // Leave viewId undefined to remove the badge from all views
  setLoadingBadge(value: boolean): void {
    this.shouldShowProgressBadge = value;
    if (value) {
      // Using closure on this to allow partial binding in arbitrary positions
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      vscode.window
        .withProgress({ location: { viewId: SNYK_VIEW_WELCOME } }, () => self.getProgressBadgePromise())
        .then(
          () => undefined,
          error => ErrorReporter.capture(error),
        );
    } else if (this.progressBadge && !this.progressBadge.isCompleted) {
      this.progressBadge.complete();
    }
  }
}
