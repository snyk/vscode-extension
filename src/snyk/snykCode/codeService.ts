import { Subscription } from 'rxjs';
import { IAnalytics } from '../common/analytics/itly';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { CodeIssueData, Scan, ScanProduct } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { ProductService } from '../common/services/productService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../common/vscode/codeAction';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { SnykCodeActionsProvider } from './codeActions/codeIssuesActionsProvider';
import { ICodeSuggestionWebviewProvider } from './views/interfaces';

export class SnykCodeService extends ProductService<CodeIssueData> {
  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: ICodeSuggestionWebviewProvider,
    readonly codeActionAdapter: ICodeActionAdapter,
    readonly codeActionKindAdapter: ICodeActionKindAdapter,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    logger: ILog,
    readonly analytics: IAnalytics,
  ) {
    super(
      extensionContext,
      config,
      suggestionProvider,
      viewManagerService,
      workspace,
      workspaceTrust,
      languageServer,
      languages,
      logger,
    );

    this.registerCodeActionsProvider(
      new SnykCodeActionsProvider(this.result, codeActionAdapter, codeActionKindAdapter, languages, analytics),
    );
  }

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan<CodeIssueData>) => {
      if (scan.product !== ScanProduct.Code) {
        return;
      }

      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    this.viewManagerService.refreshAllCodeAnalysisViews();
  }
}
