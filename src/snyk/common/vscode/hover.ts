import * as vscode from 'vscode';
import { Hover, MarkdownString, Range } from './types';

export interface IHoverAdapter {
  create(contents: MarkdownString | MarkdownString[], range?: Range): Hover;
}

export class HoverAdapter implements IHoverAdapter {
  create(contents: vscode.MarkdownString | MarkdownString[], range?: Range): Hover {
    return new vscode.Hover(contents, range);
  }
}
