import { Subscription } from 'rxjs';
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
import { CodeDetailPanelProvider } from './views/suggestion/codeDetailPanelProvider';

export class SnykCodeService extends ProductService<CodeIssueData> {
  private detailProvider: CodeDetailPanelProvider;

  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    detailProvider: CodeDetailPanelProvider,
    suggestionProvider: ICodeSuggestionWebviewProvider,
    readonly codeActionAdapter: ICodeActionAdapter,
    readonly codeActionKindAdapter: ICodeActionKindAdapter,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    logger: ILog,
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

    this.detailProvider = detailProvider;

    this.registerCodeActionsProvider(
      new SnykCodeActionsProvider(this.result, codeActionAdapter, codeActionKindAdapter, languages),
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
