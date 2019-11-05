import * as vscode from "vscode";
import DeepCodeExtension from "./deepcode/DeepCodeExtension";

const extension = new DeepCodeExtension();

export function activate(context: vscode.ExtensionContext): void {
  extension.activate(context);
}
export function deactivate() {}

export function getExtension() {
  return extension;
}
