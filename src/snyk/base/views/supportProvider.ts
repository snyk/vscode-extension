import { ThemeIcon, TreeItemCollapsibleState } from 'vscode';
import { SNYK_DCIGNORE_COMMAND } from '../../common/constants/commands';
import { TreeNode } from '../../common/views/treeNode';
import { TreeNodeProvider } from '../../common/views/treeNodeProvider';

export class SupportProvider extends TreeNodeProvider {
  getRootChildren(): TreeNode[] {
    return [
      new TreeNode({
        text: 'Send us feedback or report a bug',
        icon: new ThemeIcon('mail'),
        link: 'https://snyk.io/contact-us/?utm_source=vsc',
      }),
      new TreeNode({
        text: 'Get the most out of the Snyk extension',
        icon: new ThemeIcon('file-text'),
        link: 'https://docs.snyk.io/ide-tools/visual-studio-code-extension',
      }),
      new TreeNode({
        text: 'Ignore files and directories',
        icon: new ThemeIcon('file-text'),
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new TreeNode({
            text: 'Add a pre-filled .dcignore file',
            icon: new ThemeIcon('new-file'),
            command: {
              command: SNYK_DCIGNORE_COMMAND,
              title: '',
              arguments: [],
            },
          }),
          new TreeNode({
            text: 'Add a blank .dcignore file',
            icon: new ThemeIcon('new-file'),
            command: {
              command: SNYK_DCIGNORE_COMMAND,
              title: '',
              arguments: [true],
            },
          }),
        ],
      }),
    ];
  }
}
