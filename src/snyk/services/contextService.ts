import { setContext } from '../utils/vscodeCommandsUtils';
import * as vscode from 'vscode';
import { REFRESH_VIEW_DEBOUNCE_INTERVAL } from '../constants/general';
import _ from 'lodash';
import { Logger } from '../logger';

export interface IContextService {
  readonly viewContext: { [key: string]: unknown };
  readonly refreshViewEmitter: vscode.EventEmitter<void>;

  setContext(key: string, value: unknown): Promise<void>;
  refreshViews(): void;
}

export class ContextService implements IContextService {
  readonly viewContext: { [key: string]: unknown };
  readonly refreshViewEmitter: vscode.EventEmitter<void>;

  constructor() {
    this.viewContext = {};
    this.refreshViewEmitter = new vscode.EventEmitter<void>();
  }

  async setContext(key: string, value: unknown): Promise<void> {
    Logger.debug(`Snyk context ${key}: ${value}`);
    this.viewContext[key] = value;
    await setContext(key, value);
    this.refreshViews();
  }

  // Avoid refreshing context/views too often:
  // https://github.com/Microsoft/vscode/issues/68424
  refreshViews = _.throttle((): void => this.refreshViewEmitter.fire(), REFRESH_VIEW_DEBOUNCE_INTERVAL, {
    leading: true,
  });
}
