import * as vscode from "vscode";
import { Buffer } from "buffer";
import * as fs from 'fs';
import tsc from '@deepcode/tsc';

export const createDCIgnore = async (
  path: string,
  custom: boolean,
) => {
  const content: Buffer = Buffer.from(
    custom ? tsc.constants.DCIGNORE_DRAFTS.custom : tsc.constants.DCIGNORE_DRAFTS.default,
  );
  const filePath = `${path}/${tsc.constants.DCIGNORE_FILENAME}`;
  const openPath = vscode.Uri.file(filePath);
  // We don't want to override the dcignore file with an empty one.
  if (!custom || !fs.existsSync(filePath)) await vscode.workspace.fs.writeFile(openPath, content);
  const doc = await vscode.workspace.openTextDocument(openPath);
  vscode.window.showTextDocument(doc);
};
