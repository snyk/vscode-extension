import * as vscode from 'vscode';
import { SNYK_CONTEXT } from '../constants/views';
import { Logger } from '../logger/logger';
import { setContext } from '../vscode/vscodeCommandsUtils';

export interface IContextService {
  readonly viewContext: { [key: string]: unknown };
  readonly onDidChangeContext: vscode.Event<{ key: string; value: unknown }>;
  shouldShowCodeAnalysis: boolean;
  shouldShowOssAnalysis: boolean;
  shouldShowIacAnalysis: boolean;

  setContext(key: string, value: unknown): Promise<void>;
}

export class ContextService implements IContextService {
  readonly viewContext: { [key: string]: unknown };
  private readonly onDidChangeContextEmitter = new vscode.EventEmitter<{ key: string; value: unknown }>();
  readonly onDidChangeContext = this.onDidChangeContextEmitter.event;

  constructor() {
    this.viewContext = {};
  }

  async setContext(key: string, value: unknown): Promise<void> {
    Logger.debug(`Snyk context ${key}: ${value}`);
    this.viewContext[key] = value;
    await setContext(key, value);
    this.onDidChangeContextEmitter.fire({ key, value });
  }

  get shouldShowCodeAnalysis(): boolean {
    return this.shouldShowAnalysis && !!this.viewContext[SNYK_CONTEXT.CODE_ENABLED];
  }

  get shouldShowOssAnalysis(): boolean {
    return this.shouldShowAnalysis;
  }

  get shouldShowIacAnalysis(): boolean {
    return this.shouldShowAnalysis;
  }

  private get shouldShowAnalysis(): boolean {
    return !this.viewContext[SNYK_CONTEXT.ERROR] && [SNYK_CONTEXT.LOGGEDIN].every(c => !!this.viewContext[c]);
  }
}
