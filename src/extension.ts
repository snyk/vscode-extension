import * as vscode from "vscode";
import DeepCodeExtension from "./deepcode/DeepCodeExtension";

export function activate(context: vscode.ExtensionContext): void {
  const extension = new DeepCodeExtension();
  extension.activate(context);
}
export function deactivate() {}
