import * as vscode from 'vscode';

/**
 * A wrapper class for the vscode.ExtensionContext to provide centralised access to a collection of utilities private to the extension.
 */
export class ExtensionContext {
  private context?: vscode.ExtensionContext;

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  getExtensionUri(): vscode.Uri {
    return this.acquireContext().extensionUri;
  }

  addDisposables(...disposables: vscode.Disposable[]): void {
    this.acquireContext().subscriptions.push(...disposables);
  }

  get extensionPath(): string {
    return this.acquireContext().extensionPath;
  }

  get subscriptions(): { dispose(): unknown }[] {
    return this.acquireContext().subscriptions;
  }

  getGlobalStateValue<T>(key: string): T | undefined {
    return this.acquireContext().globalState.get(key);
  }

  updateGlobalStateValue(key: string, value: unknown): Thenable<void> {
    return this.acquireContext().globalState.update(key, value);
  }

  secrets(): vscode.SecretStorage {
    return this.acquireContext().secrets;
  }

  private acquireContext(): vscode.ExtensionContext {
    if (!this.context) throw new Error('VS Code extension context not set.');
    return this.context;
  }
}

export const extensionContext = new ExtensionContext();
