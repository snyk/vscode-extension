import { Subject, Subscription } from 'rxjs';
import { AnalysisStatusProvider } from '../analysis/statusProvider';
import { IConfiguration } from '../configuration/configuration';
import { IWorkspaceTrust } from '../configuration/trustedFolders';
import { CodeActionsProvider } from '../editor/codeActionsProvider';
import { ILanguageServer } from '../languageServer/languageServer';
import { Issue, Scan, ScanProduct, ScanStatus } from '../languageServer/types';
import { ILog } from '../logger/interfaces';
import { IViewManagerService } from './viewManagerService';
import { IProductWebviewProvider } from '../views/webviewProvider';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeLanguages } from '../vscode/languages';
import { Disposable } from '../vscode/types';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { IDiagnosticsIssueProvider } from './diagnosticsService';

export type WorkspaceFolderResult<T> = Issue<T>[] | Error;
export type ProductResult<T> = Map<string, WorkspaceFolderResult<T>>; // map of a workspace folder to results array or an error occurred in this folder

export interface IProductService<T> extends AnalysisStatusProvider, Disposable {
  result: Readonly<ProductResult<T>>;
  getIssue(folderPath: string, issueId: string): Issue<T> | undefined;
  getIssueById(issueId: string): Issue<T> | undefined;
  isAnyWorkspaceFolderTrusted: boolean;
  resetResult(folderPath: string): void;
  isAnyResultAvailable(): boolean;

  activateWebviewProviders(): void;
  showSuggestionProvider(folderPath: string, issueId: string): void;
}

export abstract class ProductService<T> extends AnalysisStatusProvider implements IProductService<T> {
  abstract readonly productType: ScanProduct;

  private _result: ProductResult<T>;
  readonly newResultAvailable$ = new Subject<void>();

  // Track running scan count. Assumption: server sends N success/error messages for N scans in progress.
  private runningScanCount = 0;

  protected lsSubscription: Subscription;

  protected disposables: Disposable[] = [];

  constructor(
    readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly suggestionProvider: IProductWebviewProvider<Issue<T>>,
    protected readonly viewManagerService: IViewManagerService,
    readonly workspace: IVSCodeWorkspace,
    private readonly workspaceTrust: IWorkspaceTrust,
    readonly languageServer: ILanguageServer,
    readonly languages: IVSCodeLanguages,
    readonly diagnosticsIssueProvider: IDiagnosticsIssueProvider<T>,
    private readonly logger: ILog,
  ) {
    super();
    this._result = new Map<string, WorkspaceFolderResult<T>>();
    this.lsSubscription = this.subscribeToLsScanMessages();
  }

  abstract subscribeToLsScanMessages(): Subscription;

  abstract refreshTreeView(): void;

  public getSnykProductType(): ScanProduct {
    return this.productType;
  }

  registerCodeActionsProvider(provider: CodeActionsProvider<T>) {
    this.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, provider);
  }

  getIssue(folderPath: string, issueId: string): Issue<T> | undefined {
    const folderResult = this._result.get(folderPath);
    if (folderResult instanceof Error) {
      return undefined;
    }

    return folderResult?.find(issue => issue.id === issueId);
  }

  getIssueById(issueId: string): Issue<T> | undefined {
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

  get result(): Readonly<ProductResult<T>> {
    return this._result;
  }

  get isAnyWorkspaceFolderTrusted(): boolean {
    const workspacePaths = this.workspace.getWorkspaceFolders();
    return this.workspaceTrust.getTrustedFolders(this.config, workspacePaths).length > 0;
  }

  resetResult(folderPath: string): void {
    this._result.delete(folderPath);
    this.refreshTreeView();
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
    this.refreshTreeView();
  }

  dispose(): void {
    this.lsSubscription.unsubscribe();
  }

  // Must be called from the child class to listen on scan messages
  handleLsScanMessage(scanMsg: Scan<T>) {
    if (scanMsg.status == ScanStatus.InProgress) {
      if (!this.isAnalysisRunning) {
        this.analysisStarted();
        this._result.set(scanMsg.folderPath, []);
        this.refreshTreeView();
      }

      this.runningScanCount++;
      return;
    }

    if (scanMsg.status == ScanStatus.Success || scanMsg.status == ScanStatus.Error) {
      this.handleSuccessOrError(scanMsg);
      this.disposeSuggestionPanelIfStale();
    }
  }

  private handleSuccessOrError(scanMsg: Scan<T>) {
    this.runningScanCount--;

    if (scanMsg.status == ScanStatus.Success) {
      const issues = this.diagnosticsIssueProvider.getIssuesFromDiagnostics(scanMsg.product);
      this._result.set(scanMsg.folderPath, issues);
    } else {
      this._result.set(scanMsg.folderPath, new Error(scanMsg.errorMessage));
    }

    if (this.runningScanCount <= 0) {
      this.analysisFinished();
      this.runningScanCount = 0;

      this.newResultAvailable$.next();
      this.refreshTreeView();
    }
  }
}
