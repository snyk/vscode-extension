import { setContext } from '../utils/vscodeCommandsUtils';
import { Logger } from '../logger';
import { IViewManagerService } from './viewManagerService';
import { SNYK_CONTEXT } from '../constants/views';

export interface IContextService {
  readonly viewContext: { [key: string]: unknown };
  shouldShowAnalysis: boolean;

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

  get shouldShowAnalysis(): boolean {
    return (
      !this.viewContext[SNYK_CONTEXT.ERROR] &&
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.CODE_ENABLED].every(c => !!this.viewContext[c])
    );
  }
}
