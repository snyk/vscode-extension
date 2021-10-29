import * as vscode from 'vscode';
import { Hover, MarkedString, Range } from './types';

export interface IHoverAdapter {
  create(contents: MarkedString | MarkedString[], range?: Range): Hover;
}

export class HoverAdapter implements IHoverAdapter {
  create(contents: MarkedString | MarkedString[], range?: Range): Hover {
    return new vscode.Hover(contents, range);
  }
}
