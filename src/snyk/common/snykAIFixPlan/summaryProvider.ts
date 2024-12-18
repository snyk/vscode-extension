import * as vscode from 'vscode';

export class SummaryTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<void | vscode.TreeItem | null | undefined> = new vscode.EventEmitter<void | vscode.TreeItem | null | undefined>();
  readonly onDidChangeTreeData: vscode.Event<void | vscode.TreeItem | null | undefined> = this._onDidChangeTreeData.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    return Promise.resolve([
      this.createItem('✋ 312 issues found in your project', 'Found 312 issues', undefined),
      this.createItem('⚡ 183 issues are fixable using DeepCode AI Fix️', '183 issues are fixable', undefined),
      this.createItem('⛔ 9 issues must be fixed to comply with company policies', '9 critical issues', undefined),
      this.createItem('', 'Separator'), // Separator
      this.createItem('Not sure where to start - we can guide you.', 'Let us guide you.', undefined),
      this.createItem('✨ Generate AI Fix Plan.]', 'Generate a plan to fix issues', undefined, {
        title: 'Generate Fix Plan',
        command: 'extension.generateFixPlan',
      }, 'cta-button'),
    ]);
  }

  private createItem(
    label: string, 
    tooltip: string, 
    icon?: vscode.ThemeIcon, 
    command?: vscode.Command, 
    cssClass?: string
  ): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    treeItem.tooltip = tooltip || undefined;
    treeItem.iconPath = icon || undefined;
    treeItem.command = command;
    
    // Add CSS class if provided
    if (cssClass) {
      (treeItem as any).contextValue = cssClass;
    }
    
    return treeItem;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}