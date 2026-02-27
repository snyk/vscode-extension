import { ILog } from '../../common/logger/interfaces';
import { TreeViewWebviewProvider } from '../../common/views/treeViewWebviewProvider';

export interface ITreeViewProviderService {
  updateTreeViewPanel(treeViewHtml: string): void;
}

export class TreeViewProviderService implements ITreeViewProviderService {
  constructor(
    private readonly logger: ILog,
    private readonly treeViewWebviewProvider: TreeViewWebviewProvider | undefined,
  ) {}

  public updateTreeViewPanel(treeViewHtml: string) {
    if (!this.treeViewWebviewProvider) {
      this.logger.error('TreeView Webview Provider was not initialized.');
      return;
    }
    try {
      this.treeViewWebviewProvider.updateWebviewContent(treeViewHtml);
    } catch (error) {
      this.logger.error('Failed to update TreeView panel');
    }
  }
}
