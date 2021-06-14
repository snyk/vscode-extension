import { ProviderResult, TreeDataProvider } from 'vscode';
import { ExtensionInterface } from '../../interfaces/SnykInterfaces';
import { Node } from './Node';

export abstract class NodeProvider implements TreeDataProvider<Node> {
  constructor(protected extension: ExtensionInterface) {}

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

  onDidChangeTreeData = this.extension.refreshViewEmitter.event;
}
