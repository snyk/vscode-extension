import * as vscode from 'vscode';
import { ProductIssueTreeProvider } from '../views/issueTreeProvider';
import { TreeNode } from '../views/treeNode';
import { ILanguageServer } from '../languageServer/languageServer';
import { LsScanProduct } from '../languageServer/types';
import { Subscription } from 'rxjs';
import { Disposable } from '../vscode/types';
import { IVSCodeCommands } from '../vscode/commands';
import { SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';

export class ProductTreeViewService<T> implements Disposable {
  protected lsShowIssueDetailSubscription: Subscription;

  constructor(
    private readonly treeView: vscode.TreeView<TreeNode>,
    private readonly productIssueTreeProvider: ProductIssueTreeProvider<T>,
    private readonly languageServer: ILanguageServer,
    readonly lsScanProduct: LsScanProduct,
  ) {
    this.lsShowIssueDetailSubscription = this.subscribeToShowIssueDetailMessages();
  }

  dispose(): void {
    this.lsShowIssueDetailSubscription.unsubscribe();
  }

  private subscribeToShowIssueDetailMessages(): Subscription {
    return this.languageServer.showIssueDetailTopic$.subscribe(params => {
      if (params.product !== this.lsScanProduct) {
        return;
      }
      void this.productIssueTreeProvider.revealIssueById(this.treeView, params.issueId);
    });
  }
}
