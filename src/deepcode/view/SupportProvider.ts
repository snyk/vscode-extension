import { TreeItemCollapsibleState } from 'vscode';
import { NodeProvider } from './NodeProvider';
import { Node } from './Node';

export class SupportProvider extends NodeProvider {
  getRootChildren(): Node[] {
    return [
      new Node({
        text: "Contact DeepCode",
        description: "Send us a feedback or ask for support",
        link: "https://www.deepcode.ai/feedback?select=2?utm_source=vsc"
      }),
      new Node({
        text: "Documentation",
        description: "Check our documentation online",
        link: "https://deepcode.freshdesk.com/support/home"
      }),
      new Node({
        text: "Interested in our on-premise solution?",
        link: "https://www.deepcode.ai/on-premises?utm_source=vsc"
      }),
      new Node({
        text: "Top 3 FAQ",
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new Node({
            text: "Here is how to get the most out of DeepCode’s extension",
            link: "https://www.youtube.com/watch?v=NIDeVYLWkMI"
          }),
          new Node({
            text: "How to ignore files and directories",
            link: "https://deepcode.freshdesk.com/support/solutions/articles/60000531055-how-can-i-ignore-files-or-directories-"
          }),
          new Node({
            text: "Here is how to ignore issues within the code",
            link: "https://www.youtube.com/watch?v=sjDuDqUy7pw"
          }),
        ]
      }),
    ];
  }
}