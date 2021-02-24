import * as vscode from 'vscode';
import SnykExtension from './snyk/snykExtension';

const extension = new SnykExtension();

export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating SnykExtension');
  extension.activate(context);
}
export function deactivate() {
  console.log('Deactivating SnykExtension');
  extension.deactivate();
}

export function getExtension() {
  return extension;
}
