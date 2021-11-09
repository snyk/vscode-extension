import { ProviderResult, TreeDataProvider } from 'vscode';
import { TreeNode } from './treeNode';

export abstract class TreeNodeProvider implements TreeDataProvider<TreeNode> {
  abstract getRootChildren(): ProviderResult<TreeNode[]>;

  getChildren(element?: TreeNode): ProviderResult<TreeNode[]> {
    if (element) return element.getChildren();
    return this.getRootChildren();
  }

  getParent(element: TreeNode): TreeNode | undefined {
    return element.getParent();
  }

  getTreeItem(element: TreeNode): TreeNode {
    return element;
  }
}
