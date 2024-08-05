import { Subscription } from 'rxjs';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { IacIssueData, Scan, ScanProduct } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { ProductService } from '../common/services/productService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../common/vscode/codeAction';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { IacCodeActionsProvider } from './codeActions/iacCodeActionsProvider';
import { IIacSuggestionWebviewProvider } from './views/interfaces';
import { IDiagnosticsIssueProvider } from '../common/services/diagnosticsService';

export class IacService extends ProductService<IacIssueData> {
  public readonly productType = ScanProduct.InfrastructureAsCode;

  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: IIacSuggestionWebviewProvider,
    readonly codeActionAdapter: ICodeActionAdapter,
    readonly codeActionKindAdapter: ICodeActionKindAdapter,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    readonly diagnosticsIssueProvider: IDiagnosticsIssueProvider<IacIssueData>,
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
      diagnosticsIssueProvider,
      logger,
    );

    this.registerCodeActionsProvider(
      new IacCodeActionsProvider(this.result, codeActionAdapter, codeActionKindAdapter, languages),
    );
  }

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan<IacIssueData>) => {
      if (scan.product !== ScanProduct.InfrastructureAsCode) {
        return;
      }

      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    this.viewManagerService.refreshIacView();
  }
}
