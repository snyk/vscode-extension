import * as vscode from 'vscode';
import { Logger } from '../logger/logger';
import { ExtensionContext } from '../vscode/extensionContext';

export abstract class WebviewProvider {
  protected disposables: vscode.Disposable[] = [];

  protected panel?: vscode.WebviewPanel;

  constructor(protected readonly context: ExtensionContext) {}

  protected getWebViewUri(...pathSegments: string[]): vscode.Uri | undefined {
    return this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.getExtensionUri(), ...pathSegments));
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    if (this.panel) this.panel.dispose();
    this.panel = panel;
  }

  protected async focusSecondEditorGroup(): Promise<void> {
    // workaround for: https://github.com/microsoft/vscode/issues/71608
    // when resolved, we can set showPanel back to sync execution.
    await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
  }

  protected disposePanel(): void {
    if (this.panel) this.panel.dispose();
  }

  protected onPanelDispose(): void {
    this.panel = undefined;

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  protected async checkVisibility(): Promise<void> {
    if (this.panel && this.panel.visible) {
      try {
        await this.panel.webview.postMessage({ type: 'get' });
      } catch (e) {
        if (!this.panel) return; // can happen due to asynchronicity, ignore such cases
        Logger.error(`Failed to restore the '${this.panel.title}' webview.`);
      }
    }
  }

  protected abstract getHtmlForWebview(webview: vscode.Webview): string;
  protected abstract activate(...params: unknown[]): void;
}
