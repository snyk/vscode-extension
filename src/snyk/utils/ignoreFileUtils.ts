import { constants } from '@snyk/code-client';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as vscode from 'vscode';

export const createDCIgnore = async (path: string, custom: boolean) => {
  const content: Buffer = Buffer.from(custom ? constants.DCIGNORE_DRAFTS.custom : constants.DCIGNORE_DRAFTS.default);
  const filePath = `${path}/${constants.DCIGNORE_FILENAME}`;
  const openPath = vscode.Uri.file(filePath);
  // We don't want to override the dcignore file with an empty one.
  if (!custom || !fs.existsSync(filePath)) await vscode.workspace.fs.writeFile(openPath, content);
  const doc = await vscode.workspace.openTextDocument(openPath);
  void vscode.window.showTextDocument(doc);
};
