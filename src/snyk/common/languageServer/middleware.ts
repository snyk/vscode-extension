import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../logger/interfaces';
import { User } from '../user';
import type {
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  WorkspaceMiddleware,
  ShowDocumentParams,
  ShowDocumentResult,
  WindowMiddleware,
} from '../vscode/types';
import { CancellationToken } from '../vscode/types';
import { LanguageServerSettings, ServerSettings } from './settings';
import { ShowIssueDetailTopicParams, LsScanProduct, SnykURIAction } from './types';
import { Subject } from 'rxjs';

type LanguageClientWorkspaceMiddleware = Partial<WorkspaceMiddleware> & {
  configuration: (
    params: ConfigurationParams,
    token: CancellationToken,
    next: ConfigurationRequestHandlerSignature,
  ) => Promise<ResponseError<void> | ServerSettings[]>;
};

export class LanguageClientMiddleware implements Middleware {
  constructor(
    private readonly logger: ILog,
    private configuration: IConfiguration,
    private user: User,
    private showIssueDetailTopic$: Subject<ShowIssueDetailTopicParams>,
  ) {}

  workspace: LanguageClientWorkspaceMiddleware = {
    configuration: async (
      params: ConfigurationParams,
      token: CancellationToken,
      next: ConfigurationRequestHandlerSignature,
    ) => {
      let settings = next(params, token);
      if (this.isThenable(settings)) {
        settings = await settings;
      }

      if (settings instanceof Error) {
        return settings;
      }

      if (!settings.length) {
        return [];
      }

      const serverSettings = await LanguageServerSettings.fromConfiguration(this.configuration, this.user);
      return [serverSettings];
    },
  };
  window: WindowMiddleware = {
    showDocument: async (params: ShowDocumentParams, next) => {
      let uri;
      try {
        uri = new URL(params.uri);
      } catch (error) {
        throw new Error('Invalid URI recieved for window/showDocument');
      }
      if (uri.protocol === 'snyk:') {
        // 'snyk://filePath?product=Snyk+Code&issueId=123abc456&action=showInDetailPanel'
        const action = uri.searchParams.get('action');
        if (action === SnykURIAction.ShowInDetailPanel) {
          this.logger.info(
            `Intercepted window/showDocument request (action=${SnykURIAction.ShowInDetailPanel}): ${params.uri}`,
          );
          const _filePath = uri.pathname;
          const product = uri.searchParams.get('product');
          if (product !== LsScanProduct.Code) {
            throw new Error(`Currently only able to handle showing issues for "${LsScanProduct.Code}"`);
          }
          const issueId = uri.searchParams.get('issueId');
          if (issueId === null || issueId === '') {
            throw new Error(`Invalid "snyk:" URI recieved (bad issueId)! ${params.uri}`);
          }

          this.showIssueDetailTopic$.next({
            product,
            issueId,
          });

          // TODO: select issue that matches product + issueId in the tree and maybe refresh it
          // don't continue processing

          return { success: true };
        }
      }
      return (await next(params, CancellationToken.None)) as ShowDocumentResult;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isThenable<T>(v: any): v is Thenable<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return typeof v?.then === 'function';
  }
}
