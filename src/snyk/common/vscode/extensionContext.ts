import * as vscode from 'vscode';

/**
 * A wrapper class for the vscode.ExtensionContext to provide centralised access to a collection of utilities private to the extension.
 */
export class ExtensionContext {
  private context?: vscode.ExtensionContext;

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  get extensionPath(): string {
    if (!this.context) throw new Error('VS Code extension context not set.');
    return this.context.extensionPath;
  }

  get subscriptions(): { dispose(): unknown }[] {
    if (!this.context) throw new Error('VS Code extension context not set.');
    return this.context.subscriptions;
  }

  getGlobalStateValue<T>(key: string): T | undefined {
    if (!this.context) throw new Error('VS Code extension context not set.');
    return this.context.globalState.get(key);
  }

  updateGlobalStateValue(key: string, value: unknown): Thenable<void> {
    if (!this.context) throw new Error('VS Code extension context not set.');
    return this.context.globalState.update(key, value);
  }
}

export const extensionContext = new ExtensionContext();
