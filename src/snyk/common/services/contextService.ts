import { SNYK_CONTEXT } from '../constants/views';
import { Logger } from '../logger/logger';
import { setContext } from '../vscode/vscodeCommandsUtils';

export interface IContextService {
  readonly viewContext: { [key: string]: unknown };
  shouldShowCodeAnalysis: boolean;
  shouldShowOssAnalysis: boolean;

  setContext(key: string, value: unknown): Promise<void>;
}

export class ContextService implements IContextService {
  readonly viewContext: { [key: string]: unknown };

  constructor() {
    this.viewContext = {};
  }

  async setContext(key: string, value: unknown): Promise<void> {
    Logger.debug(`Snyk context ${key}: ${value}`);
    this.viewContext[key] = value;
    await setContext(key, value);
  }

  get shouldShowCodeAnalysis(): boolean {
    return this.shouldShowAnalysis && !!this.viewContext[SNYK_CONTEXT.CODE_ENABLED];
  }

  get shouldShowOssAnalysis(): boolean {
    return this.shouldShowAnalysis;
  }

  private get shouldShowAnalysis(): boolean {
    return !this.viewContext[SNYK_CONTEXT.ERROR] && [SNYK_CONTEXT.LOGGEDIN].every(c => !!this.viewContext[c]);
  }
}
