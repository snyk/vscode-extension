import * as vscode from 'vscode';
import { Logger } from './snyk/common/logger/logger';
import SnykExtension from './snyk/extension';

const extension = new SnykExtension();

export function activate(context: vscode.ExtensionContext): void {
  Logger.info('Activating SnykExtension');
  extension.activate(context);
}
export function deactivate(): void {
  Logger.info('Deactivating SnykExtension');
  void extension.deactivate();
}

export function getExtension(): SnykExtension {
  return extension;
}
