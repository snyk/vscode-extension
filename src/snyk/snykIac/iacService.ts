import { Subscription } from 'rxjs';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { IacIssueData, Issue, Scan, ScanProduct, ScanStatus } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { Disposable } from '../common/vscode/types';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { IacResult, IacWorkspaceFolderResult } from './iacResult';
import { IIacSuggestionWebviewProvider } from './views/interfaces';
export interface IIacService extends AnalysisStatusProvider, Disposable {
  result: Readonly<IacResult>;
  getIssue(folderPath: string, issueId: string): Issue<IacIssueData> | undefined;
  getIssueById(issueId: string): Issue<IacIssueData> | undefined;
  isAnyWorkspaceFolderTrusted: boolean;
  resetResult(folderPath: string): void;
  isAnyResultAvailable(): boolean;

  activateWebviewProviders(): void;
  showSuggestionProvider(folderPath: string, issueId: string): void;
}

export class IacService extends AnalysisStatusProvider implements IIacService {
  private _result: IacResult;

  // Track running scan count. Assumption: server sends N success/error messages for N scans in progress.
  private runningScanCount = 0;

  private lsSubscription: Subscription;

  protected disposables: Disposable[] = [];

  constructor(
    readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly suggestionProvider: IIacSuggestionWebviewProvider,
    // readonly codeActionAdapter: ICodeActionAdapter,
    // readonly codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly viewManagerService: IViewManagerService,
    readonly workspace: IVSCodeWorkspace,
    private readonly workspaceTrust: IWorkspaceTrust,
    readonly languageServer: ILanguageServer,
    // readonly window: IVSCodeWindow,
    // readonly languages: IVSCodeLanguages,
    private readonly logger: ILog, // readonly analytics: IAnalytics,
  ) {
    super();
    this._result = new Map<string, IacWorkspaceFolderResult>();
    // const provider = new iacCodeActionsProvider(
    //   this.result,
    //   codeActionAdapter,
    //   codeActionKindAdapter,
    //   languages,
    //   analytics,
    // );
    // this.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, provider);

    this.lsSubscription = languageServer.scan$.subscribe((scan: Scan<IacIssueData>) => this.handleLsScanMessage(scan));
  }

  getIssue(folderPath: string, issueId: string): Issue<IacIssueData> | undefined {
    const folderResult = this._result.get(folderPath);
    if (folderResult instanceof Error) {
      return undefined;
    }

    return folderResult?.find(issue => issue.id === issueId);
  }

  getIssueById(issueId: string): Issue<IacIssueData> | undefined {
    const results = this._result.values();
    for (const folderResult of results) {
      if (folderResult instanceof Error) {
        return undefined;
      }

      const issue = folderResult?.find(issue => issue.id === issueId);
      if (issue) {
        return issue;
      }
    }

    return undefined;
  }

  get result(): Readonly<IacResult> {
    return this._result;
  }

  get isAnyWorkspaceFolderTrusted(): boolean {
    const workspacePaths = this.workspace.getWorkspaceFolders();
    return this.workspaceTrust.getTrustedFolders(this.config, workspacePaths).length > 0;
  }

  resetResult(folderPath: string): void {
    this._result.delete(folderPath);
    this.viewManagerService.refreshIacView();
  }

  public isAnyResultAvailable(): boolean {
    return this._result.size > 0;
  }

  activateWebviewProviders(): void {
    this.suggestionProvider.activate();
  }

  showSuggestionProvider(folderPath: string, issueId: string): Promise<void> {
    const issue = this.getIssue(folderPath, issueId);
    if (!issue) {
      this.logger.error(`Failed to find issue with id ${issueId} to open a details panel.`);
      return Promise.resolve();
    }

    return this.suggestionProvider.showPanel(issue);
  }

  disposeSuggestionPanelIfStale(): void {
    const openIssueId = this.suggestionProvider.openIssueId;
    if (!openIssueId) return;

    const found = this.getIssueById(openIssueId);
    if (!found) this.suggestionProvider.disposePanel();
  }

  override handleLsDownloadFailure(): void {
    super.handleLsDownloadFailure();
    this.viewManagerService.refreshIacView();
  }

  dispose(): void {
    this.lsSubscription.unsubscribe();
  }

  private handleLsScanMessage(scanMsg: Scan<IacIssueData>) {
    if (scanMsg.product !== ScanProduct.InfrastructureAsCode) {
      return;
    }

    if (scanMsg.status == ScanStatus.InProgress) {
      if (!this.isAnalysisRunning) {
        this.analysisStarted();
        this._result.set(scanMsg.folderPath, []);
        this.viewManagerService.refreshIacView();
      }

      this.runningScanCount++;
      return;
    }

    if (scanMsg.status == ScanStatus.Success || scanMsg.status == ScanStatus.Error) {
      this.handleSuccessOrError(scanMsg);
      this.disposeSuggestionPanelIfStale();
    }
  }

  private handleSuccessOrError(scanMsg: Scan<IacIssueData>) {
    this.runningScanCount--;

    if (scanMsg.status == ScanStatus.Success) {
      this._result.set(scanMsg.folderPath, scanMsg.issues);
    } else {
      this._result.set(scanMsg.folderPath, new Error('Failed to analyze.'));
    }

    if (this.runningScanCount <= 0) {
      this.analysisFinished();
      this.runningScanCount = 0;

      this.viewManagerService.refreshIacView();
    }
  }
}
