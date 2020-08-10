import { TreeItemCollapsibleState } from 'vscode';
import { NodeProvider } from './NodeProvider'
import { Node } from './Node'

export class SupportProvider extends NodeProvider {
  getRootChildren(): Node[] {
    return [
      new Node({
        text: "Contact DeepCode",
        description: "Send us a feedback or ask for support",
        link: "https://www.deepcode.ai/feedback?select=2"
      }),
      new Node({
        text: "Documentation",
        description: "Check our documentation online",
        link: "https://deepcode.freshdesk.com/support/home"
      }),
    ]
  }
}