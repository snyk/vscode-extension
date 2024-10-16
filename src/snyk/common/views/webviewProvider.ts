import * as vscode from 'vscode';
import { ILog } from '../logger/interfaces';
import { Logger } from '../logger/logger';
import { ExtensionContext } from '../vscode/extensionContext';
import { WebviewOptions } from '../vscode/types';

export interface IProductWebviewProvider<T> extends IWebViewProvider<T> {
  openIssueId: string | undefined;
}

export interface IWebViewProvider<ViewModel> {
  activate(): void;
  disposePanel(): void;
  showPanel(suggestion: ViewModel, ...args: unknown[]): Promise<void>;
  getWebviewOptions(): WebviewOptions;
}

export abstract class WebviewProvider<ViewModel> implements IWebViewProvider<ViewModel> {
  protected disposables: vscode.Disposable[] = [];

  protected panel?: vscode.WebviewPanel;

  constructor(protected readonly context: ExtensionContext, protected readonly logger: ILog) {}

  protected getWebViewUri(...pathSegments: string[]): vscode.Uri | undefined {
    return this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.getExtensionUri(), ...pathSegments));
  }

  restorePanel(panel: vscode.WebviewPanel): void {
    if (this.panel) this.panel.dispose();
    this.panel = panel;
    this.registerListeners();
  }

  abstract showPanel(suggestion: ViewModel, ...args: unknown[]): Promise<void>;
  protected abstract registerListeners(): void;

  protected async focusSecondEditorGroup(): Promise<void> {
    // workaround for: https://github.com/microsoft/vscode/issues/71608
    // when resolved, we can set showPanel back to sync execution.
    await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
  }

  getWebviewOptions(): WebviewOptions {
    return {
      localResourceRoots: [this.context.getExtensionUri()],
      enableScripts: true,
    };
  }

  disposePanel(): void {
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

  protected checkVisibility(): void {
    if (this.panel && this.panel.visible) {
      try {
        void this.panel.webview.postMessage({ type: 'get' });
        void this.panel.webview.postMessage({ type: 'getLesson' });
      } catch (e) {
        if (!this.panel) return; // can happen due to asynchronicity, ignore such cases
        Logger.error(`Failed to restore the '${this.panel.title}' webview.`);
      }
    }
  }

  abstract activate(): void;
}
