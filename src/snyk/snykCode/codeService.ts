import { Subscription } from 'rxjs';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { CodeIssueData, Issue, Scan, ScanProduct, ScanStatus } from '../common/languageServer/types';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { Disposable } from '../common/vscode/types';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { ICodeSuggestionWebviewProvider } from './views/interfaces';

export interface ISnykCodeService extends AnalysisStatusProvider, Disposable {
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;
  result: Readonly<CodeResult>;
  isAnyWorkspaceFolderTrusted: boolean;

  activateWebviewProviders(): void;
}

// Keep type declarations temporarily here, until we get rid of code-client types.
// todo: tidy up during 'lsCode' feature flag drop
export type CodeResult = Map<string, CodeWorkspaceFolderResult>; // map of a workspace folder to results array or an error occurred in this folder
export type CodeWorkspaceFolderResult = Issue<CodeIssueData>[] | Error;

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  private _result: CodeResult;
  readonly suggestionProvider: ICodeSuggestionWebviewProvider;

  // Track running scan count. Assumption: server sends N success/error messages for N scans in progress.
  private runningScanCount = 0;

  private lsSubscription: Subscription;

  constructor(
    readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly viewManagerService: IViewManagerService,
    readonly workspace: IVSCodeWorkspace,
    private readonly workspaceTrust: IWorkspaceTrust,
    readonly languageServer: ILanguageServer,
  ) {
    super();
    // this.analyzer = new SnykCodeAnalyzer(
    //   logger,
    //   languages,
    //   workspace,
    //   analytics,
    //   errorHandler,
    //   this.uriAdapter,
    //   this.config,
    // ); // todo: update in ROAD-1158
    // this.registerAnalyzerProviders(this.analyzer); // todo: update in ROAD-1158

    // this.suggestionProvider = new CodeSuggestionWebviewProvider(
    //   config,
    //   this.analyzer,
    //   window,
    //   extensionContext,
    //   this.logger,
    //   languages,
    //   workspace,
    //   codeSettings,
    //   this.learnService,
    // ); // todo: update in ROAD-1158

    this.lsSubscription = languageServer.scan$.subscribe((scan: Scan<CodeIssueData>) => this.handleLsScanMessage(scan));
    this._result = new Map<string, CodeWorkspaceFolderResult>();
  }

  get result(): Readonly<CodeResult> {
    return this._result;
  }

  get isAnyWorkspaceFolderTrusted(): boolean {
    const workspacePaths = this.workspace.getWorkspaceFolders();
    return this.workspaceTrust.getTrustedFolders(this.config, workspacePaths).length > 0;
  }

  activateWebviewProviders(): void {
    this.suggestionProvider.activate();
  }

  override handleLsDownloadFailure(): void {
    super.handleLsDownloadFailure();
    this.viewManagerService.refreshAllCodeAnalysisViews();
  }

  dispose(): void {
    this.lsSubscription.unsubscribe();
  }

  private handleLsScanMessage(scanMsg: Scan<CodeIssueData>) {
    if (scanMsg.product !== ScanProduct.Code) {
      return;
    }

    if (scanMsg.status == ScanStatus.InProgress) {
      if (!this.isAnalysisRunning) {
        this.analysisStarted();
        this._result.set(scanMsg.folderPath, []);
        this.viewManagerService.refreshAllCodeAnalysisViews();
      }

      this.runningScanCount++;
      return;
    }

    if (scanMsg.status == ScanStatus.Success || scanMsg.status == ScanStatus.Error) {
      this.handleSuccessOrError(scanMsg);
    }
  }

  private handleSuccessOrError(scanMsg: Scan<CodeIssueData>) {
    this.runningScanCount--;

    // prepare results for the view
    if (this.runningScanCount <= 0) {
      this.analysisFinished();
      this.runningScanCount = 0;

      if (scanMsg.status == ScanStatus.Success) {
        this._result.set(scanMsg.folderPath, scanMsg.issues);
      } else {
        this._result.set(scanMsg.folderPath, new Error('Failed to analyze.'));
      }

      this.viewManagerService.refreshAllCodeAnalysisViews();
    }
  }
}
