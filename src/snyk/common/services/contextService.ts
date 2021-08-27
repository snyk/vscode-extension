import { setContext } from '../vscodeCommandsUtils';
import { Logger } from '../logger/logger';
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
      [SNYK_CONTEXT.LOGGEDIN, SNYK_CONTEXT.CODE_ENABLED].every(c => !!this.viewContext[c]) // todo: ensure correct work for OSS Tree view in ROAD-270 wrt to Code Enabled context.
    );
  }
}
