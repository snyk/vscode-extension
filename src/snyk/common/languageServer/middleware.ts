import { IConfiguration } from '../configuration/configuration';
import { ILog } from '../logger/interfaces';
import { productToLsProduct } from '../services/mappings';
import { isEnumStringValueOf, isThenable } from '../tsUtil';
import { User } from '../user';
import type {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  Middleware,
  ResponseError,
  ShowDocumentParams,
  ShowDocumentResult,
  WindowMiddleware,
  WorkspaceMiddleware,
} from '../vscode/types';
import { LanguageServerSettings, ServerSettings } from './settings';
import { LsScanProduct, ScanProduct, ShowIssueDetailTopicParams, SnykURIAction } from './types';
import { Subject } from 'rxjs';

export type LspRange = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};
export type OpenFileInEditorFn = (uri: string, selection?: LspRange) => Promise<void>;

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
    private openFileInEditor?: OpenFileInEditorFn,
  ) {}

  workspace: LanguageClientWorkspaceMiddleware = {
    configuration: async (
      params: ConfigurationParams,
      token: CancellationToken,
      next: ConfigurationRequestHandlerSignature,
    ) => {
      let settings = next(params, token);
      if (isThenable(settings)) {
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
      const callNext = next as (params: ShowDocumentParams) => Promise<ShowDocumentResult>;
      let uri;
      try {
        // TODO: Change this to use URI parsing instead of URL parsing.
        uri = new URL(decodeURI(params.uri).replaceAll('\\', '/'));
      } catch (error) {
        this.logger.debug('Invalid URI received for window/showDocument');
        return await callNext(params);
      }

      // Looking for 'snyk://filePath?product=Snyk+Code&issueId=123abc456&action=showInDetailPanel'
      if (uri.protocol !== 'snyk:' || uri.searchParams.get('action') !== SnykURIAction.ShowInDetailPanel) {
        if (this.openFileInEditor && uri.protocol === 'file:') {
          await this.openFileInEditor(params.uri, params.selection as LspRange | undefined);
          return { success: true };
        }
        return await callNext(params);
      }

      this.logger.debug(
        `Intercepted window/showDocument request (action=${SnykURIAction.ShowInDetailPanel}): ${params.uri}`,
      );
      const product = uri.searchParams.get('product');
      if (
        product === null ||
        (!isEnumStringValueOf(ScanProduct, product) && !isEnumStringValueOf(LsScanProduct, product))
      ) {
        this.logger.error(`Invalid "snyk:" URI received (bad or unknown product)! ${params.uri}`);
        return { success: false };
      }
      const issueId = uri.searchParams.get('issueId');
      if (issueId === null || issueId === '') {
        this.logger.error(`Invalid "snyk:" URI received (bad issueId)! ${params.uri}`);
        return { success: false };
      }

      let lsproduct: LsScanProduct;
      if (isEnumStringValueOf(ScanProduct, product)) {
        lsproduct = productToLsProduct(product as ScanProduct);
      } else {
        lsproduct = product as LsScanProduct;
      }

      this.showIssueDetailTopic$.next({
        product: lsproduct,
        issueId,
      });

      return { success: true };
    },
  };
}
