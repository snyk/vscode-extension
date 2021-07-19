import _ from 'lodash';
import { EventEmitter } from 'vscode';
import { configuration, FeaturesConfiguration } from '../configuration';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../constants/general';
import { PendingTask, PendingTaskInterface } from '../utils/pendingTask';

export interface IViewManagerService {
  initializedView: PendingTaskInterface;
  emitViewInitialized(): void;

  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;
  refreshCodeSecurityView(): void;
  refreshCodeQualityView(): void;
  refreshAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void;
}

export class ViewManagerService implements IViewManagerService {
  readonly initializedView: PendingTaskInterface;
  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;

  constructor() {
    this.initializedView = new PendingTask();
    this.refreshCodeSecurityViewEmitter = new EventEmitter<void>();
    this.refreshCodeQualityViewEmitter = new EventEmitter<void>();
  }

  emitViewInitialized(): void {
    if (!this.initializedView.isCompleted) this.initializedView.complete();
  }

  refreshAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void {
    enabledFeatures = enabledFeatures ?? configuration.getFeaturesConfiguration();

    if (!enabledFeatures) {
      return;
    }

    if (enabledFeatures.codeSecurityEnabled) {
      this.refreshCodeSecurityView();
    }
    if (enabledFeatures.codeQualityEnabled) {
      this.refreshCodeQualityView();
    }
  }

  // Avoid refreshing context/views too often:
  // https://github.com/Microsoft/vscode/issues/68424
  refreshCodeSecurityView = _.throttle(
    (): void => this.refreshCodeSecurityViewEmitter.fire(),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    {
      leading: true,
    },
  );

  refreshCodeQualityView = _.throttle(
    (): void => this.refreshCodeQualityViewEmitter.fire(),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    {
      leading: true,
    },
  );
}
