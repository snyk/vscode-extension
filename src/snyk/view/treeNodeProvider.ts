import { ProviderResult, TreeDataProvider } from 'vscode';
import { Node } from './node';

export abstract class TreeNodeProvider implements TreeDataProvider<Node> {
  abstract getRootChildren(): Node[];

  getChildren(element?: Node): ProviderResult<Node[]> {
    if (element) return element.getChildren();
    return this.getRootChildren();
  }

  getParent(element: Node): Node | undefined {
    return element.getParent();
  }

  getTreeItem(element: Node): Node {
    return element;
  }
}
