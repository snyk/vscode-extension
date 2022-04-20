import { constants } from '@snyk/code-client';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { IUriAdapter } from '../../common/vscode/uri';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

export const createDCIgnore = async (
  path: string,
  custom: boolean,
  workspace: IVSCodeWorkspace,
  window: IVSCodeWindow,
  uriAdapter: IUriAdapter,
): Promise<void> => {
  const content: Buffer = Buffer.from(custom ? constants.DCIGNORE_DRAFTS.custom : constants.DCIGNORE_DRAFTS.default);
  const filePath = `${path}/${constants.DCIGNORE_FILENAME}`;
  const openPath = uriAdapter.file(filePath);
  // We don't want to override the dcignore file with an empty one.
  if (!custom || !fs.existsSync(filePath)) await workspace.fs.writeFile(openPath, content);
  const doc = await workspace.openTextDocumentViaUri(openPath);
  void window.showTextDocument(doc);
};
