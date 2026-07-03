import { Command, Range, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { SNYK_OPEN_BROWSER_COMMAND, SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';

interface INodeIcon {
  ['light']: string;
  ['dark']: string;
}

type InternalType = {
  nIssues?: number;
  severity?: number;
  isError?: boolean;
};

type TreeNodeIssueType = {
  id: string;
  uri: Uri;
  filePath: string;
  range?: Range;
};

interface INodeOptions {
  text: string;
  description?: string;
  descriptionTail?: string;
  issue?: TreeNodeIssueType;
  link?: string;
  icon?: INodeIcon | ThemeIcon;
  command?: Command;
  collapsed?: TreeItemCollapsibleState;
  children?: TreeNode[];
  internal?: InternalType;
}

type INode = TreeItem & {
  readonly internal: InternalType;
  readonly issue: TreeNodeIssueType | undefined;
};

export class TreeNode extends TreeItem implements INode {
  readonly internal: InternalType;
  readonly issue: TreeNodeIssueType | undefined;
  private parent: TreeNode | undefined;
  private children: TreeNode[] | undefined;

  constructor(options: INodeOptions) {
    const collapsed =
      options.collapsed || (options.children && TreeItemCollapsibleState.Collapsed) || TreeItemCollapsibleState.None;
    super(options.text, collapsed);
    this.iconPath = options.icon;
    this.tooltip = options.description || options.text;
    let desc = options.description;
    if (!desc && options.issue) {
      desc = options.issue.uri.path.split('/').pop() || '';
      if (options.issue.range) {
        desc += `[${options.issue.range.start.line + 1}, `;
        desc += `${options.issue.range.start.character + 1}]`;
      }
    }
    this.description = desc;
    this.command =
      options.command ||
      (options.link && {
        command: SNYK_OPEN_BROWSER_COMMAND,
        title: '',
        arguments: [options.link],
      }) ||
      (options.issue && {
        command: SNYK_OPEN_LOCAL_COMMAND,
        title: '',
        arguments: [options.issue.filePath, options.issue.range],
      });
    // Not using `options.issue.uri` to avoid default file decorators (see Explorer tab)
    // However, as of August 2020, there is still no way to manually decorate tree items
    // https://github.com/microsoft/vscode/issues/47502
    // this.resourceUri = options.link ? Uri.parse(options.link) : (options.issue && options.issue.uri);
    this.children = options.children;
    this.internal = options.internal || {};
    this.issue = options.issue;

    this.children?.forEach(childNode => (childNode.parent = this));
  }

  getParent(): TreeNode | undefined {
    return this.parent;
  }

  getChildren(): TreeNode[] {
    return this.children || [];
  }
}
