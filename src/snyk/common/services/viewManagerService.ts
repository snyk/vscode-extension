import _ from 'lodash';
import { EventEmitter, TreeView } from 'vscode';
import { FeaturesConfiguration } from '../configuration/configuration';
import { configuration } from '../configuration/instance';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../constants/general';
import { TreeNode } from '../views/treeNode';

type ViewType = TreeView<TreeNode>;

class ViewContainer {
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
  readonly refreshOssViewEmitter: EventEmitter<void>;
  readonly refreshIacViewEmitter: EventEmitter<void>;
  readonly refreshSecretsViewEmitter: EventEmitter<void>;

  refreshAllViews(): void;
  refreshAllCodeAnalysisViews(): void;
  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void;
  refreshCodeSecurityView(): void;
  refreshOssView(): void;
  refreshIacView(): void;
  refreshSecretsView(): void;
}

export class ViewManagerService implements IViewManagerService {
  readonly viewContainer: ViewContainer;

  readonly refreshCodeSecurityViewEmitter: EventEmitter<void>;

  readonly refreshOssViewEmitter: EventEmitter<void>;

  readonly refreshIacViewEmitter: EventEmitter<void>;

  readonly refreshSecretsViewEmitter: EventEmitter<void>;

  constructor() {
    this.refreshCodeSecurityViewEmitter = new EventEmitter<void>();

    this.refreshOssViewEmitter = new EventEmitter<void>();
    this.viewContainer = new ViewContainer();

    this.refreshIacViewEmitter = new EventEmitter<void>();
    this.refreshSecretsViewEmitter = new EventEmitter<void>();
  }

  refreshAllViews(): void {
    this.refreshOssView();
    this.refreshAllCodeAnalysisViews();
    this.refreshIacView();
    this.refreshSecretsView();
  }

  refreshAllCodeAnalysisViews(): void {
    this.refreshCodeSecurityView();
  }

  refreshCodeAnalysisViews(enabledFeatures?: FeaturesConfiguration | null): void {
    enabledFeatures = enabledFeatures ?? configuration.getFeaturesConfiguration();

    if (!enabledFeatures) {
      return;
    }

    if (enabledFeatures.codeSecurityEnabled) {
      this.refreshCodeSecurityView();
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

  refreshOssView = _.throttle((): void => this.refreshOssViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });

  refreshIacView = _.throttle((): void => this.refreshIacViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });

  refreshSecretsView = _.throttle((): void => this.refreshSecretsViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });
}
