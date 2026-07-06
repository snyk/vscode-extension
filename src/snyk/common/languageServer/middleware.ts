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
import type { IExplicitLspConfigurationChangeTracker } from './explicitLspConfigurationChangeTracker';
import { unmarkResetLsKeysAfterPull } from './explicitLsKeyTracking';
import { LanguageServerSettings } from './settings';
import { LspConfigurationParam, LsScanProduct, ScanProduct, ShowIssueDetailTopicParams, SnykURIAction } from './types';
import { Subject } from 'rxjs';

/**
 * ADR-2: Re-enqueue guard predicate.
 *
 * Returns true when the re-enqueue for `lsKey` should be SKIPPED (i.e. the user
 * committed a concrete value for this key in the current window, so restoring
 * the reset would clobber it).
 *
 * Reads `committedSinceReset` — a transient, windowed, per-LS-key signal — NOT
 * `isExplicitlyChanged` (cumulative, persisted, cross-session, fanned-out across
 * shared VS Code settings).  The shared predicate is extracted here so both call
 * sites (middleware.ts and languageServer.ts) stay in sync.
 */
export function shouldSkipReenqueue(
  lsKey: string,
  tracker: IExplicitLspConfigurationChangeTracker | undefined,
): boolean {
  return tracker?.committedSinceReset(lsKey) ?? false;
}

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
    private readonly explicitLspConfigurationChangeTracker?: IExplicitLspConfigurationChangeTracker,
    private readonly isInboundPersistenceSuppressed: () => boolean = () => false,
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

      // Consume any pending outbound resets before building the param so they are
      // emitted as { value: null, changed: true } exactly once on this pull.
      const pendingResets = this.explicitLspConfigurationChangeTracker?.consumePendingResets() ?? new Set<string>();

      let lspParam: Awaited<ReturnType<typeof LanguageServerSettings.fromConfiguration>>;
      try {
        lspParam = await LanguageServerSettings.fromConfiguration(
          this.configuration,
          lsKey => this.explicitLspConfigurationChangeTracker?.isExplicitlyChanged(lsKey) ?? false,
          this.vscodeWorkspace,
          lsKey => pendingResets.has(lsKey),
        );
      } catch (err) {
        // fromConfiguration failed after consumePendingResets() already drained the set.
        // Re-enqueue keys for prompt, deterministic delivery on the next pull — but only if the
        // user has NOT committed a concrete value for this key since the drain.
        //
        // ADR-2: The guard reads `committedSinceReset` (transient, windowed, per-LS-key) instead
        // of `isExplicitlyChanged` (cumulative, persisted, cross-session, fanned-out).
        // `isExplicitlyChanged` answered the wrong question: it was true if the key was ever
        // customised (prior session), if a sibling sharing the same VS Code setting was edited
        // (fan-out), or if an inbound write slipped past the suppressor — all of which would
        // incorrectly drop a legitimate re-enqueue.  `committedSinceReset` is set only when the
        // user genuinely commits a concrete value for exactly this LS key in this window.
        for (const key of pendingResets) {
          if (!shouldSkipReenqueue(key, this.explicitLspConfigurationChangeTracker)) {
            this.explicitLspConfigurationChangeTracker?.markPendingReset(key);
          }
        }
        throw err;
      }

      if (this.explicitLspConfigurationChangeTracker && lspParam.settings) {
        // Pending-reset keys emitted as {value:null, changed:true} were already unmarked at
        // save time by applyOutboundGlobalResets, so this unmark pass is safely idempotent
        // (Set.delete of an absent key is a no-op).
        unmarkResetLsKeysAfterPull(lspParam.settings, this.explicitLspConfigurationChangeTracker);
      }

      return [{ settings: lspParam }];
    },
    didChangeConfiguration: async (sections, next) => {
      if (this.isInboundPersistenceSuppressed()) {
        this.logger.debug('didChangeConfiguration suppressed during inbound LS persistence');
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
