import * as vscode from 'vscode';
import DeepCodeExtension from './deepcode/DeepCodeExtension';

const extension = new DeepCodeExtension();

export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating DeepCodeExtension');
  extension.activate(context);
}
export function deactivate() {
  console.log('Deactivating DeepCodeExtension');
  extension.deactivate();
}

export function getExtension() {
  return extension;
}
