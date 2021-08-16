import _ from 'lodash';
import { EventEmitter, TreeView } from 'vscode';
import { FeaturesConfiguration } from '../configuration/configuration';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../constants/general';
import { FeaturesViewProvider } from '../../base/views/featureSelection/featuresViewProvider';
import { TreeNode } from '../views/treeNode';
import { configuration } from '../configuration/instance';

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
  refreshCodeSecurityView(): void;
  refreshCodeQualityView(): void;
  refreshAllAnalysisViews(): void;
  refreshFeatureAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void;
}

export class ViewManagerService implements IViewManagerService {
  readonly viewContainer: ViewContainer;

  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;
  readonly refreshCodeQualityViewEmitter: EventEmitter<void>;

  constructor() {
    this.refreshCodeSecurityViewEmitter = new EventEmitter<void>();
    this.refreshCodeQualityViewEmitter = new EventEmitter<void>();
    this.viewContainer = new ViewContainer();
  }

  refreshAllAnalysisViews(): void {
    this.refreshCodeSecurityView();
    this.refreshCodeQualityView();
  }

  refreshFeatureAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void {
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
