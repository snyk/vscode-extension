import { Subscription } from "rxjs";
import { IAnalytics } from "../common/analytics/itly";
import { IConfiguration } from "../common/configuration/configuration";
import { IWorkspaceTrust } from "../common/configuration/trustedFolders";
import { ILanguageServer } from "../common/languageServer/languageServer";
import { OssIssueData, Scan, ScanProduct } from "../common/languageServer/types";
import { ILog } from "../common/logger/interfaces";
import { ProductService } from "../common/services/productService";
import { IViewManagerService } from "../common/services/viewManagerService";
import { ICodeActionAdapter, ICodeActionKindAdapter } from "../common/vscode/codeAction";
import { ExtensionContext } from "../common/vscode/extensionContext";
import { IVSCodeLanguages } from "../common/vscode/languages";
import { IVSCodeWorkspace } from "../common/vscode/workspace";
import { IOssSuggestionWebviewProvider } from "./views/interfaces";

export class OssServiceLanguageServer extends ProductService<OssIssueData> {
  constructor(
    extensionContext: ExtensionContext,
    config: IConfiguration,
    suggestionProvider: IOssSuggestionWebviewProvider,
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

    // this.registerCodeActionsProvider(
    //   new OssCodeActionsProvider(this.result, codeActionAdapter, codeActionKindAdapter, languages, analytics),
    // );
  }

  subscribeToLsScanMessages(): Subscription {
    return this.languageServer.scan$.subscribe((scan: Scan<OssIssueData>) => {
      if (scan.product !== ScanProduct.OpenSource) {
        return;
      }

      console.log("received OSS scan message", scan); // TODO: delete
      super.handleLsScanMessage(scan);
    });
  }

  refreshTreeView() {
    this.viewManagerService.refreshOssView();
  }
}
