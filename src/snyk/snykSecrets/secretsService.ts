import { Subscription } from 'rxjs';
import { IConfiguration } from '../common/configuration/configuration';
import { IWorkspaceTrust } from '../common/configuration/trustedFolders';
import { ILanguageServer } from '../common/languageServer/languageServer';
import { LsScanProduct, Scan, ScanProduct, SecretIssueData } from '../common/languageServer/types';
import { ILog } from '../common/logger/interfaces';
import { IDiagnosticsIssueProvider } from '../common/services/diagnosticsService';
import { ProductService } from '../common/services/productService';
import { IViewManagerService } from '../common/services/viewManagerService';
import { ExtensionContext } from '../common/vscode/extensionContext';
import { IVSCodeLanguages } from '../common/vscode/languages';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { ISecretsSuggestionWebviewProvider } from './views/interfaces';

export class SecretsService extends ProductService<SecretIssueData> {
  public readonly productType = ScanProduct.Secrets;

  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: ISecretsSuggestionWebviewProvider,
    viewManagerService: IViewManagerService,
    workspace: IVSCodeWorkspace,
    workspaceTrust: IWorkspaceTrust,
    languageServer: ILanguageServer,
    languages: IVSCodeLanguages,
    readonly diagnosticsIssueProvider: IDiagnosticsIssueProvider<SecretIssueData>,
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
    this.viewManagerService.refreshSecretsView();
  }
}
