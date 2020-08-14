import { Uri, Range, Command, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { DEEPCODE_OPEN_BROWSER, DEEPCODE_OPEN_LOCAL } from "../constants/commands";

export interface INodeOptions {
  text: string,
  description?: string,
  issue?: {
    uri: Uri,
    range?: Range,
  },
  link?: string,
  command?: Command,
  collapsed?: TreeItemCollapsibleState,
  parent?: Node,
  children?: Node[],
}


export class Node extends TreeItem {
  private parent: Node | undefined;
  private children: Node[] | undefined;

  constructor(options: INodeOptions) {
    const collapsed = options.collapsed || (options.children && TreeItemCollapsibleState.Collapsed) || TreeItemCollapsibleState.None;
    super(options.text, collapsed);
    this.tooltip = options.description || options.text;
    let desc = options.description;
    if (!desc && options.issue) {
      desc = options.issue.uri.path.split('/').pop() || "";
      if (options.issue.range) {
        desc += "[" + (options.issue.range.start.line + 1) + ",";
        desc += (options.issue.range.start.character + 1) + "]";
      }
    }
    this.description = desc;
    this.command = options.command || (options.link && {
      command: DEEPCODE_OPEN_BROWSER,
      title: '',
      arguments: [options.link],
    }) || (options.issue && {
      command: DEEPCODE_OPEN_LOCAL,
      title: '',
      arguments: [options.issue.uri, options.issue.range],
    });
    this.resourceUri = (options.link && Uri.parse(options.link)) || (options.issue && options.issue.uri);
    this.parent = options.parent;
    this.children = options.children;
  }

  getParent(): Node | undefined {
    return this.parent;
  }

  getChildren(): Node[] {
    return this.children || [];
  }
}
