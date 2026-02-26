import { Subscription } from 'rxjs';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { LsScanProduct, Scan, ScanProduct, SecretsIssueData } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { ProductService } from '../common/services/productService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { IProductWebviewProvider } from '../common/views/webviewProvider';
import { IDiagnosticsIssueProvider } from '../common/services/diagnosticsService';
import { Issue } from '../common/languageServer/types';

export class SecretsService extends ProductService<SecretsIssueData> {
  public readonly productType = ScanProduct.Secrets;

  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: IProductWebviewProvider<Issue<SecretsIssueData>>,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    diagnosticsIssueProvider: IDiagnosticsIssueProvider<SecretsIssueData>,
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
      LsScanProduct.Secrets,
    );
  }

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan) => {
      if (scan.product !== ScanProduct.Secrets) {
        return;
      }

      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    // Secrets tree is managed by the HTML tree view
  }
}
