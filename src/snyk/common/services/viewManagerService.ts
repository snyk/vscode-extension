import _ from 'lodash';
import { EventEmitter, TreeView } from 'vscode';
import { FeaturesViewProvider } from '../../base/views/featureSelection/featuresViewProvider';
import { FeaturesConfiguration } from '../configuration/configuration';
import { configuration } from '../configuration/instance';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../constants/general';
import { TreeNode } from '../views/treeNode';

export type ViewType = FeaturesViewProvider | TreeView<TreeNode>;

export class ViewContainer {
  private container = new Map<string, ViewType>();

  get<T extends ViewType>(key: string): T | undefined {
    return this.container.get(key) as T;
  }

  set<T extends ViewType>(key: string, value: T): void {
    this.container.set(key, value);
  }
}

export interface IViewManagerService {
  viewContainer: ViewContainer;

  readonly refreshOldCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshOldCodeQualityViewEmitter: EventEmitter<void>;
  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;
  readonly refreshOssViewEmitter: EventEmitter<void>;

  refreshAllViews(): void;
  refreshAllCodeAnalysisViews(): void;
  refreshAllOldCodeAnalysisViews(): void;
  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void;
  refreshCodeSecurityView(): void;
  refreshCodeQualityView(): void;
  refreshOssView(): void;
}

export class ViewManagerService implements IViewManagerService {
  readonly viewContainer: ViewContainer;

  readonly refreshOldCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshOldCodeQualityViewEmitter: EventEmitter<void>;
  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;

  readonly refreshOssViewEmitter: EventEmitter<void>;

  constructor() {
    this.refreshOldCodeSecurityViewEmitter = new EventEmitter<void>();
    this.refreshOldCodeQualityViewEmitter = new EventEmitter<void>();
    this.refreshCodeSecurityViewEmitter = new EventEmitter<void>();
    this.refreshCodeQualityViewEmitter = new EventEmitter<void>();

    this.refreshOssViewEmitter = new EventEmitter<void>();
    this.viewContainer = new ViewContainer();
  }

  refreshAllViews(): void {
    this.refreshOssView();
    this.refreshAllOldCodeAnalysisViews();
  }

  refreshAllOldCodeAnalysisViews(): void {
    this.refreshOldCodeSecurityView();
    this.refreshOldCodeQualityView();
  }

  refreshAllCodeAnalysisViews(): void {
    this.refreshCodeSecurityView();
    // this.refreshCodeQualityView(); // todo: uncomment when not debugging any more
  }

  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void {
    enabledFeatures = enabledFeatures ?? configuration.getFeaturesConfiguration();

    if (!enabledFeatures) {
      return;
    }

    if (enabledFeatures.codeSecurityEnabled) {
      this.refreshOldCodeSecurityView();
    }
    if (enabledFeatures.codeQualityEnabled) {
      this.refreshOldCodeQualityView();
    }
  }

  // Avoid refreshing context/views too often:
  // https://github.com/Microsoft/vscode/issues/68424
  refreshOldCodeSecurityView = _.throttle(
    (): void => this.refreshOldCodeSecurityViewEmitter.fire(),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    {
      leading: true,
    },
  );

  refreshOldCodeQualityView = _.throttle(
    (): void => this.refreshOldCodeQualityViewEmitter.fire(),
    REFRESH_VIEW_DEBOUNCE_INTERVAL,
    {
      leading: true,
    },
  );

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

  refreshOssView = _.throttle((): void => this.refreshOssViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });
}
