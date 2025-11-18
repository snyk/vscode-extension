import * as vscode from 'vscode';
import { IVSCodeClipboard } from './clipboard';

export interface IVSCodeEnv {
  getUiKind(): string;
  getRemoteName(): string | undefined;
  getAppName(): string;
  getAppHost(): string;
  getClipboard(): IVSCodeClipboard;
}

class VSCodeEnv implements IVSCodeEnv {
  getUiKind(): string {
    return vscode.UIKind[vscode.env.uiKind];
  }

  getRemoteName(): string | undefined {
    return vscode.env.remoteName;
  }

  getAppName(): string {
    return vscode.env.appName;
  }

  getAppHost(): string {
    return vscode.env.appHost;
  }

  getClipboard(): IVSCodeClipboard {
    return vscode.env.clipboard;
  }
}

export const vsCodeEnv = new VSCodeEnv();
