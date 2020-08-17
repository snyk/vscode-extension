import { TreeItemCollapsibleState, ThemeIcon } from 'vscode';
import { NodeProvider } from './NodeProvider';
import { Node } from './Node';

export class SupportProvider extends NodeProvider {
  getRootChildren(): Node[] {
    return [
      new Node({
        text: "Contact DeepCode",
        description: "Send us a feedback or ask for support",
        icon: new ThemeIcon('mail'),
        link: "https://www.deepcode.ai/feedback?select=2?utm_source=vsc"
      }),
      new Node({
        text: "Documentation",
        description: "Check our documentation online",
        icon: new ThemeIcon('book'),
        link: "https://deepcode.freshdesk.com/support/home"
      }),
      new Node({
        text: "Interested in our on-premise solution?",
        icon: new ThemeIcon('desktop-download'),
        link: "https://www.deepcode.ai/on-premises?utm_source=vsc"
      }),
      new Node({
        text: "Top 3 FAQ",
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new Node({
            text: "1. Here is how to get the most out of DeepCode’s extension",
            icon: new ThemeIcon('play'),
            link: "https://www.youtube.com/watch?v=NIDeVYLWkMI"
          }),
          new Node({
            text: "2. How to ignore files and directories",
            icon: new ThemeIcon('file-text'),
            link: "https://deepcode.freshdesk.com/support/solutions/articles/60000531055-how-can-i-ignore-files-or-directories-"
          }),
          new Node({
            text: "3. Here is how to ignore issues within the code",
            icon: new ThemeIcon('play'),
            link: "https://www.youtube.com/watch?v=sjDuDqUy7pw"
          }),
        ]
      }),
    ];
  }
}