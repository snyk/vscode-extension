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

  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;
  readonly refreshOssViewEmitter: EventEmitter<void>;

  refreshAllViews(): void;
  refreshAllCodeAnalysisViews(): void;
  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void;
  refreshCodeSecurityView(): void;
  refreshCodeQualityView(): void;
  refreshOssView(): void;
}

export class ViewManagerService implements IViewManagerService {
  readonly viewContainer: ViewContainer;

  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;
  readonly refreshOssViewEmitter: EventEmitter<void>;

  constructor() {
    this.refreshCodeSecurityViewEmitter = new EventEmitter<void>();
    this.refreshCodeQualityViewEmitter = new EventEmitter<void>();
    this.refreshOssViewEmitter = new EventEmitter<void>();
    this.viewContainer = new ViewContainer();
  }

  refreshAllViews(): void {
    this.refreshOssView();
    this.refreshAllCodeAnalysisViews();
  }

  refreshAllCodeAnalysisViews(): void {
    this.refreshCodeSecurityView();
    this.refreshCodeQualityView();
  }

  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void {
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

  refreshOssView = _.throttle((): void => this.refreshOssViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });
}
