import { IConfiguration } from '../configuration/configuration';
import { SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';
import { ILog } from '../logger/interfaces';
import { productToLsProduct } from '../services/mappings';
import { isEnumStringValueOf, isThenable } from '../tsUtil';
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
import type { IExplicitOverridesMap } from './explicitOverridesMap';
import {
  confirmResetsDeliveredAfterPull,
  hasUnreflectedConfigurationChange,
  isExplicitlyChanged,
  isPendingReset,
} from './explicitLsKeyTracking';
import type { ILastKnownValueCache } from './lastKnownValueCache';
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
    private showIssueDetailTopic$: Subject<ShowIssueDetailTopicParams>,
    private uriAdapter: IUriAdapter,
    private commands: IVSCodeCommands,
    private readonly vscodeWorkspace?: IVSCodeWorkspace,
    private readonly lastKnownValueCache?: ILastKnownValueCache,
    private readonly explicitOverridesMap?: IExplicitOverridesMap,
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

      // [IDE-2264 ticket 09]: the explicit-overrides map is the sole source for `changed` —
      // both 'value' and 'reset' entries count. Reset entries are read live — never drained
      // before the response is built — so a failure below leaves every entry intact for an
      // automatic retry on the next pull. No re-enqueue bookkeeping needed.
      const lspParam = await LanguageServerSettings.fromConfiguration(
        this.configuration,
        lsKey => isExplicitlyChanged(lsKey, this.explicitOverridesMap),
        this.vscodeWorkspace,
        lsKey => isPendingReset(lsKey, this.explicitOverridesMap),
      );

      if (this.explicitOverridesMap && lspParam.settings) {
        // Confirm delivery only now that the response was built successfully — never before.
        confirmResetsDeliveredAfterPull(lspParam.settings, this.explicitOverridesMap);
      }

      return [{ settings: lspParam }];
    },
    didChangeConfiguration: async (sections, next) => {
      // [IDE-2264 ticket 05]: computed fresh on every call against current VS Code state — no
      // shared per-event flag. Agrees with the configuration-change-event handler's own decision
      // (explicitLsKeyTracking.ts) regardless of listener registration order — see
      // hasUnreflectedConfigurationChange's doc comment for why.
      if (
        this.vscodeWorkspace &&
        this.lastKnownValueCache &&
        !hasUnreflectedConfigurationChange(this.vscodeWorkspace, this.lastKnownValueCache)
      ) {
        this.logger.debug('didChangeConfiguration suppressed: matches last-known-value cache');
        return;
      }
      await next(sections);
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
