import * as vscode from 'vscode';

export type DiagnosticsOverview = {
  product: 'oss' | 'code' | 'iac';
  html: string;
  folderPath: string;
  folderHash: string;
};

export class SnykDiagnosticsWebviewViewProvider implements vscode.WebviewViewProvider {
  private static instance: SnykDiagnosticsWebviewViewProvider;
  private webviewView: vscode.WebviewView | undefined;

  public static getInstance(): SnykDiagnosticsWebviewViewProvider {
    if (!SnykDiagnosticsWebviewViewProvider.instance) {
      SnykDiagnosticsWebviewViewProvider.instance = new SnykDiagnosticsWebviewViewProvider();
    }
    return SnykDiagnosticsWebviewViewProvider.instance;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
  }

  public updateWebviewContent(html: string): void {
    if (this.webviewView) {
      this.webviewView.webview.html = html;
    }
  }
}
