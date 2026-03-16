import * as vscode from 'vscode';
import SnykExtension from './snyk/extension';

const extension = new SnykExtension();

export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating Snyk Extension');
  void extension.activate(context);
}

export function deactivate(): void {
  console.log('Deactivating Snyk Extension');
  void extension.deactivate();
}

export function getExtension(): SnykExtension {
  return extension;
}
