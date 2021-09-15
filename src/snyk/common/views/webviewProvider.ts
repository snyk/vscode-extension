import * as vscode from 'vscode';
import { ExtensionContext } from '../vscode/extensionContext';

export abstract class WebviewProvider {
  protected panel?: vscode.WebviewPanel;

  constructor(protected readonly context: ExtensionContext) {}

  protected getWebViewUri(...pathSegments: string[]): vscode.Uri | undefined {
    return this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.getExtensionUri(), ...pathSegments));
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    if (this.panel) this.panel.dispose();
    this.panel = panel;
  }

  protected disposePanel(): void {
    if (this.panel) this.panel.dispose();
  }

  protected onPanelDispose(): void {
    this.panel = undefined;
  }

  protected checkVisibility(_e: vscode.WebviewPanelOnDidChangeViewStateEvent): void {
    if (this.panel && this.panel.visible) {
      void this.panel.webview.postMessage({ type: 'get' });
    }
  }

  protected abstract getHtmlForWebview(webview: vscode.Webview): string;
  protected abstract activate(...params: unknown[]): void;
}
