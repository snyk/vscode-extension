import * as vscode from "vscode";
import { Buffer } from "buffer";
import { fs } from "mz";
import { CustomDCIgnore, DefaultDCIgnore } from "@deepcode/dcignore";

export const createDCIgnore = async (
  path: string,
  custom: boolean,
) => {
  const content: Buffer =  Buffer.from(custom ? CustomDCIgnore : DefaultDCIgnore);
  const filePath = `${path}/.dcignore`;
  const openPath = vscode.Uri.file(filePath);
  // We don't want to override the dcignore file with an empty one.
  if (!custom || !fs.existsSync(filePath)) await vscode.workspace.fs.writeFile(openPath, content);
  const doc = await vscode.workspace.openTextDocument(openPath);
  vscode.window.showTextDocument(doc);
};