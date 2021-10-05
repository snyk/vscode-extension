import * as path from 'path';
import { Command, Range, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { SNYK_OPEN_BROWSER_COMMAND, SNYK_OPEN_LOCAL_COMMAND } from '../constants/commands';

export interface INodeIcon {
  ['light']: string;
  ['dark']: string;
}

type NODE_ICON_TYPE = 'critical' | 'high' | 'medium' | 'low' | 'error';

export const NODE_ICONS: { [key in NODE_ICON_TYPE]: INodeIcon } = {
  critical: {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-critical-severity.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-critical-severity.svg'),
  },
  high: {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-high-severity.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-high-severity.svg'),
  },
  medium: {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-medium-severity.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-medium-severity.svg'),
  },
  low: {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-low-severity.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'dark-low-severity.svg'),
  },
  error: {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'warning.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'media', 'images', 'warning.svg'),
  },
};

export type InternalType = {
  nIssues?: number;
  severity?: number;
  isError?: boolean;
};

export interface INodeOptions {
  text: string;
  description?: string;
  descriptionTail?: string;
  issue?: {
    uri: Uri;
    range?: Range;
  };
  link?: string;
  icon?: INodeIcon | ThemeIcon;
  command?: Command;
  collapsed?: TreeItemCollapsibleState;
  parent?: TreeNode;
  children?: TreeNode[];
  internal?: InternalType;
}

export type INode = TreeItem & {
  readonly internal: InternalType;
};

export class TreeNode extends TreeItem implements INode {
  readonly internal: InternalType;
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
        arguments: [options.issue.uri, options.issue.range],
      });
    // Not using `options.issue.uri` to avoid default file decorators (see Explorer tab)
    // However, as of August 2020, there is still no way to manually decorate tree items
    // https://github.com/microsoft/vscode/issues/47502
    // this.resourceUri = options.link ? Uri.parse(options.link) : (options.issue && options.issue.uri);
    this.parent = options.parent;
    this.children = options.children;
    this.internal = options.internal || {};
  }

  getParent(): TreeNode | undefined {
    return this.parent;
  }

  getChildren(): TreeNode[] {
    return this.children || [];
  }
}
