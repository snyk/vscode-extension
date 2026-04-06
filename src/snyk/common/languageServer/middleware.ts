import { IConfiguration } from '../configuration/configuration';
import { SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';
import { ILog } from '../logger/interfaces';
import { productToLsProduct } from '../services/mappings';
import { isEnumStringValueOf, isThenable } from '../tsUtil';
import { User } from '../user';
import { IVSCodeCommands } from '../vscode/commands';
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
import { IUriAdapter } from '../vscode/uri';
import type { IVSCodeWorkspace } from '../vscode/workspace';
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import { serverSettingsToLspConfigurationParam } from './serverSettingsToLspConfigurationParam';
import { LanguageServerSettings } from './settings';
import { LspConfigurationParam, LsScanProduct, ScanProduct, ShowIssueDetailTopicParams, SnykURIAction } from './types';
import { Subject } from 'rxjs';

/** snyk-ls unmarshals the pull response as `[]DidChangeConfigurationParams` where each element is `{ settings: LspConfigurationParam }`. */
type LspPullResponseItem = { settings: LspConfigurationParam };

type LanguageClientWorkspaceMiddleware = Partial<WorkspaceMiddleware> & {
  configuration: (
    params: ConfigurationParams,
    token: CancellationToken,
    next: ConfigurationRequestHandlerSignature,
  ) => Promise<ResponseError<void> | LspPullResponseItem[]>;
};

export class LanguageClientMiddleware implements Middleware {
  constructor(
    private readonly logger: ILog,
    private configuration: IConfiguration,
    private user: User,
    private showIssueDetailTopic$: Subject<ShowIssueDetailTopicParams>,
    private uriAdapter: IUriAdapter,
    private commands: IVSCodeCommands,
    private readonly vscodeWorkspace?: IVSCodeWorkspace,
    private readonly explicitLspConfigurationChangeTracker?: IExplicitLspConfigurationChangeTracker,
  ) {}

  private async openFileInEditor(uriString: string, selection?: ShowDocumentParams['selection']): Promise<void> {
    const uri = this.uriAdapter.parse(uriString);
    await this.commands.executeCommand(SNYK_OPEN_LOCAL_COMMAND, uri, selection);
  }

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

      const serverSettings = await LanguageServerSettings.fromConfiguration(
        this.configuration,
        this.user,
        this.vscodeWorkspace,
      );
      const lspParam = serverSettingsToLspConfigurationParam(
        serverSettings,
        lsKey => this.explicitLspConfigurationChangeTracker?.isExplicitlyChanged(lsKey) ?? false,
      );

      // After sending a reset (value: null, changed: true) the LS clears the override,
      // so unmark the key to avoid permanently re-sending changed: true on future pulls.
      if (this.explicitLspConfigurationChangeTracker && lspParam.settings) {
        for (const [key, entry] of Object.entries(lspParam.settings)) {
          if (entry.value === null && entry.changed === true) {
            this.explicitLspConfigurationChangeTracker.unmarkExplicitlyChanged(key);
          }
        }
      }

      return [{ settings: lspParam }];
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
        if (uri.protocol === 'file:') {
          await this.openFileInEditor(params.uri, params.selection);
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
