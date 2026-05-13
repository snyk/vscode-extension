import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SNYK_GET_ACTIVE_USER } from './constants/commands';
import { MEMENTO_ANONYMOUS_ID } from './constants/globalState';
import { IVSCodeCommands } from './vscode/commands';
import { ExtensionContext } from './vscode/extensionContext';
import { ILog } from './logger/interfaces';

export type UserDto = {
  id: string;
  username: string;
};

export class User {
  private _authenticatedId?: string;
  private readonly logger?: ILog;

  readonly anonymousId: string;

  constructor(anonymousId?: string, authenticatedId?: string, logger?: ILog) {
    this.anonymousId = anonymousId ?? uuidv4();
    this._authenticatedId = authenticatedId ?? undefined;
    this.logger = logger ?? undefined;
  }

  static async getAnonymous(context: ExtensionContext, logger?: ILog): Promise<User> {
    let anonymousId = context.getGlobalStateValue<string>(MEMENTO_ANONYMOUS_ID);
    if (!anonymousId) {
      anonymousId = uuidv4();
      await context.updateGlobalStateValue(MEMENTO_ANONYMOUS_ID, anonymousId);
    }

    return new User(anonymousId, undefined, logger ?? undefined);
  }

  get authenticatedId(): string | undefined {
    return this._authenticatedId;
  }

  get hashedAuthenticatedId(): string | undefined {
    if (!this._authenticatedId) {
      return undefined;
    }

    return crypto.createHash('sha256').update(this._authenticatedId).digest('hex');
  }

  async identify(commandExecutor: IVSCodeCommands): Promise<void> {
    const user = await this.userMe(commandExecutor);
    if (user && user.id) {
      this._authenticatedId = user.id;
    }
  }

  private async userMe(commandExecutor: IVSCodeCommands): Promise<UserDto | undefined> {
    let user: UserDto | undefined;
    try {
      user = await commandExecutor.executeCommand(SNYK_GET_ACTIVE_USER);
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Failed to get user: ${error}`);
      }
    }
    return user;
  }
}
