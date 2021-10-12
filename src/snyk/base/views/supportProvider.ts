import { ThemeIcon, TreeItemCollapsibleState } from 'vscode';
import { SNYK_DCIGNORE_COMMAND } from '../../common/constants/commands';
import { TreeNode } from '../../common/views/treeNode';
import { TreeNodeProvider } from '../../common/views/treeNodeProvider';

export class SupportProvider extends TreeNodeProvider {
  getRootChildren(): TreeNode[] {
    return [
      new TreeNode({
        text: 'Help Snyk to make a better extension',
        icon: new ThemeIcon('mortar-board'),
        link: 'https://calendly.com/snyk-georgi/45min',
      }),
      new TreeNode({
        text: 'Send us feedback or report a bug',
        icon: new ThemeIcon('mail'),
        link: 'https://snyk.io/contact-us/?utm_source=vsc',
      }),
      new TreeNode({
        text: 'Top 3 FAQ',
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new TreeNode({
            text: '1. How to get the most out of Snyk’s extension?',
            icon: new ThemeIcon('file-text'),
            link: 'https://docs.snyk.io/features/integrations/ide-tools/visual-studio-code-extension-for-snyk-code',
          }),
          new TreeNode({
            text: '2. How to ignore files and directories?',
            icon: new ThemeIcon('file-text'),
            collapsed: TreeItemCollapsibleState.Expanded,
            children: [
              new TreeNode({
                text: 'Add default .dcignore file to your workspace',
                icon: new ThemeIcon('new-file'),
                command: {
                  command: SNYK_DCIGNORE_COMMAND,
                  title: '',
                  arguments: [],
                },
              }),
              new TreeNode({
                text: 'Add a custom .dcignore file to your workspace',
                icon: new ThemeIcon('new-file'),
                command: {
                  command: SNYK_DCIGNORE_COMMAND,
                  title: '',
                  arguments: [true],
                },
              }),
            ],
          }),
        ],
      }),
    ];
  }
}
