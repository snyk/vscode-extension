import * as vscode from 'vscode';
import { SNYK_NAME } from '../../common/constants/general';
import { SNYK_SETTINGS_COMMAND } from '../../common/constants/commands';

export interface IStatusBarItem {
  snykStatusBarItem: vscode.StatusBarItem;
  show(): void;
}

class SnykStatusBarItem implements IStatusBarItem {
  public snykStatusBarItem: vscode.StatusBarItem;
  public constructor() {
    this.snykStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    this.snykStatusBarItem.text = SNYK_NAME;
  }

  public show(): void {
    this.snykStatusBarItem.command = SNYK_SETTINGS_COMMAND;
    this.snykStatusBarItem.show();
  }
}

export default SnykStatusBarItem;
