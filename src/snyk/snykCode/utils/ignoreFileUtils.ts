import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { IUriAdapter } from '../../common/vscode/uri';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

const DCIGNORE_FILENAME = '.dcignore';
export const createDCIgnore = async (
  path: string,
  custom: boolean,
  workspace: IVSCodeWorkspace,
  window: IVSCodeWindow,
  uriAdapter: IUriAdapter,
): Promise<void> => {
  const content: Buffer = Buffer.from(custom ? CustomDCIgnore : DefaultDCIgnore);
  const filePath = `${path}/${DCIGNORE_FILENAME}`;
  const openPath = uriAdapter.file(filePath);
  // We don't want to override the dcignore file with an empty one.
  if (!custom || !fs.existsSync(filePath)) await workspace.fs.writeFile(openPath, content);
  const doc = await workspace.openTextDocumentViaUri(openPath);
  void window.showTextDocument(doc);
};
