import * as vscode from 'vscode';
import { StatusBarItemInterface } from '../../../interfaces/SnykInterfaces';
import { SNYK_NAME } from '../../constants/general';
import { SNYK_SETTINGS_COMMAND } from '../../constants/commands';

class SnykStatusBarItem implements StatusBarItemInterface {
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
