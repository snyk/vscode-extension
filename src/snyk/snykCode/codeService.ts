import { Subscription } from 'rxjs';
import { AnalysisStatusProvider } from '../common/analysis/statusProvider';
import { IAnalytics } from '../common/analytics/itly';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { CodeIssueData, Issue, Scan, ScanProduct, ScanStatus } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../common/vscode/codeAction';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { Disposable } from '../common/vscode/types';
import { IVSCodeWindow } from '../common/vscode/window';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { SnykCodeActionsProvider } from './codeActions/codeIssuesActionsProvider';
import { CodeResult, CodeWorkspaceFolderResult } from './codeResult';
import { ICodeSuggestionWebviewProvider } from './views/interfaces';

export interface ISnykCodeService extends AnalysisStatusProvider, Disposable {
  result: Readonly<CodeResult>;
  getIssue(folderPath: string, issueId: string): Issue<CodeIssueData> | undefined;
  getIssueById(issueId: string): Issue<CodeIssueData> | undefined;
  isAnyWorkspaceFolderTrusted: boolean;
  resetResult(folderPath: string): void;

  activateWebviewProviders(): void;
  showSuggestionProvider(folderPath: string, issueId: string): void;
}

export class SnykCodeService extends AnalysisStatusProvider implements ISnykCodeService {
  private _result: CodeResult;

  // Track running scan count. Assumption: server sends N success/error messages for N scans in progress.
  private runningScanCount = 0;

  private lsSubscription: Subscription;

  protected disposables: Disposable[] = [];

  constructor(
    readonly extensionContext: ExtensionContext,
    private readonly config: IConfiguration,
    private readonly suggestionProvider: ICodeSuggestionWebviewProvider,
    readonly codeActionAdapter: ICodeActionAdapter,
    readonly codeActionKindAdapter: ICodeActionKindAdapter,
    private readonly viewManagerService: IViewManagerService,
    readonly workspace: IVSCodeWorkspace,
    private readonly workspaceTrust: IWorkspaceTrust,
    readonly languageServer: ILanguageServer,
    readonly window: IVSCodeWindow,
    readonly languages: IVSCodeLanguages,
    private readonly logger: ILog,
    readonly analytics: IAnalytics,
  ) {
    super();
    this._result = new Map<string, CodeWorkspaceFolderResult>();
    const provider = new SnykCodeActionsProvider(
      this.result,
      codeActionAdapter,
      codeActionKindAdapter,
      languages,
      analytics,
    );
    this.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, provider);

    this.lsSubscription = languageServer.scan$.subscribe((scan: Scan<CodeIssueData>) => this.handleLsScanMessage(scan));
  }

  getIssue(folderPath: string, issueId: string): Issue<CodeIssueData> | undefined {
    const folderResult = this._result.get(folderPath);
    if (folderResult instanceof Error) {
      return undefined;
    }

    return folderResult?.find(issue => issue.id === issueId);
  }

  getIssueById(issueId: string): Issue<CodeIssueData> | undefined {
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

  get result(): Readonly<CodeResult> {
    return this._result;
  }

  get isAnyWorkspaceFolderTrusted(): boolean {
    const workspacePaths = this.workspace.getWorkspaceFolders();
    return this.workspaceTrust.getTrustedFolders(this.config, workspacePaths).length > 0;
  }

  resetResult(folderPath: string): void {
    this._result.delete(folderPath);
    this.viewManagerService.refreshAllCodeAnalysisViews();
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
      this.disposeSuggestionPanelIfStale();
    }
  }

  private handleSuccessOrError(scanMsg: Scan<CodeIssueData>) {
    this.runningScanCount--;

    if (scanMsg.status == ScanStatus.Success) {
      this._result.set(scanMsg.folderPath, scanMsg.issues);
    } else {
      this._result.set(scanMsg.folderPath, new Error('Failed to analyze.'));
    }

    if (this.runningScanCount <= 0) {
      this.analysisFinished();
      this.runningScanCount = 0;

      this.viewManagerService.refreshAllCodeAnalysisViews();
    }
  }
}
