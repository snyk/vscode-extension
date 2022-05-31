import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IAnalytics } from './analytics/itly';
import { ISnykApiClient } from './api/apiСlient';
import { MEMENTO_ANONYMOUS_ID } from './constants/globalState';
import { ErrorReporter } from './error/errorReporter';
import { ExtensionContext } from './vscode/extensionContext';

export type UserDto = {
  id: string;
  username: string;
};

export class User {
  private _authenticatedId?: string;

  readonly anonymousId: string;

  constructor(anonymousId?: string, authenticatedId?: string) {
    this.anonymousId = anonymousId ?? uuidv4();
    this._authenticatedId = authenticatedId ?? undefined;
  }

  static async getAnonymous(context: ExtensionContext): Promise<User> {
    let anonymousId = context.getGlobalStateValue<string>(MEMENTO_ANONYMOUS_ID);
    if (!anonymousId) {
      anonymousId = uuidv4();
      await context.updateGlobalStateValue(MEMENTO_ANONYMOUS_ID, anonymousId);
    }

    return new User(anonymousId);
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

  async identify(apiClient: ISnykApiClient, analytics: IAnalytics): Promise<void> {
    const user = await this.userMe(apiClient);
    if (user && user.id) {
      this._authenticatedId = user.id;

      await analytics.identify(this._authenticatedId); // map the anonymousId onto authenticatedId
      ErrorReporter.identify(this);
    }
  }

  private async userMe(api: ISnykApiClient): Promise<UserDto | undefined> {
    const response = await api.get<UserDto>('/user/me');
    if (!response) return;

    return response.data;
  }
}
