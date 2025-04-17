import * as vscode from 'vscode';

export interface IVSCodeEnv {
  getUiKind(): string;
  getRemoteName(): string | undefined;
  getAppName(): string;
  getAppHost(): string;
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
}

export const vsCodeEnv = new VSCodeEnv();
