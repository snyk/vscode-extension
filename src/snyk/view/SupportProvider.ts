import { ThemeIcon, TreeItemCollapsibleState } from 'vscode';
import { SNYK_DCIGNORE_COMMAND } from '../constants/commands';
import { Node } from './node';
import { TreeNodeProvider } from './treeNodeProvider';

export class SupportProvider extends TreeNodeProvider {
  getRootChildren(): Node[] {
    return [
      new Node({
        text: 'Help Snyk to make a better extension',
        icon: new ThemeIcon('mortar-board'),
        link: 'https://calendly.com/snyk-georgi/45min',
      }),
      new Node({
        text: 'Send us feedback or report a bug',
        icon: new ThemeIcon('mail'),
        link: 'https://snyk.io/contact-us/?utm_source=vsc',
      }),
      new Node({
        text: 'Top 3 FAQ',
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new Node({
            text: '1. How to get the most out of Snyk’s extension?',
            icon: new ThemeIcon('play'),
            link: 'https://www.youtube.com/watch?v=NIDeVYLWkMI',
          }),
          new Node({
            text: '2. How to ignore issues within the code?',
            icon: new ThemeIcon('play'),
            link: 'https://www.youtube.com/watch?v=sjDuDqUy7pw',
          }),
          new Node({
            text: '3. How to ignore files and directories?',
            icon: new ThemeIcon('file-text'),
            link:
              'https://snyk.freshdesk.com/support/solutions/articles/60000531055-how-can-i-ignore-files-or-directories-',
            collapsed: TreeItemCollapsibleState.Expanded,
            children: [
              new Node({
                text: 'Add default .dcignore file to your workspace',
                icon: new ThemeIcon('new-file'),
                command: {
                  command: SNYK_DCIGNORE_COMMAND,
                  title: '',
                  arguments: [],
                },
              }),
              new Node({
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
