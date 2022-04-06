import * as vscode from 'vscode';
import { MarkdownString } from './types';

export interface IMarkdownStringAdapter {
  get(value?: string, supportThemeIcons?: boolean): MarkdownString;
}

export class MarkdownStringAdapter implements IMarkdownStringAdapter {
  get(value?: string, supportThemeIcons?: boolean): vscode.MarkdownString {
    return new vscode.MarkdownString(value, supportThemeIcons);
  }
}
