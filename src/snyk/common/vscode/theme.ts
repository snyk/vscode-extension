import * as vscode from 'vscode';
import { ThemeColor } from './types';

export interface IThemeColorAdapter {
  create(...args: ConstructorParameters<typeof vscode.ThemeColor>): ThemeColor;
}

export class ThemeColorAdapter implements IThemeColorAdapter {
  create(color: string): ThemeColor {
    return new vscode.ThemeColor(color);
  }
}
