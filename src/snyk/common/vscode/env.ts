import * as vscode from 'vscode';

export interface IVSCodeEnv {
  getUiKind(): string;
  getRemoteName(): string | undefined;
  getAppName(): string;
  getAppHost(): string | undefined;
}

export class VSCodeEnv implements IVSCodeEnv {
  getUiKind(): string {
    return vscode.UIKind[vscode.env.uiKind];
  }

  getRemoteName(): string | undefined {
    return vscode.env.remoteName;
  }

  getAppName(): string {
    return vscode.env.appName;
  }

  getAppHost(): string | undefined {
    // vscode.env.appHost was introduced only in engine of version >1.60.0, cast to keep old VS Code versions support for now (// TODO remove cast, once upgraded).
    // https://code.visualstudio.com/api/references/vscode-api#env.appHost
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    return (vscode.env as any).appHost;
  }
}

export const vsCodeEnv = new VSCodeEnv();
