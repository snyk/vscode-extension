import { IConfiguration } from './configuration';

import path from 'path';

export interface IWorkspaceTrust {
  getTrustedFolders(config: IConfiguration, workspaceFolders: string[]): ReadonlyArray<string>;

  resetTrustedFoldersCache(): void;
}

export class WorkspaceTrust implements IWorkspaceTrust {
  private trustedFoldersCache?: ReadonlyArray<string>;

  getTrustedFolders(config: IConfiguration, workspaceFolders: string[]): ReadonlyArray<string> {
    if (this.trustedFoldersCache !== undefined) {
      return this.trustedFoldersCache;
    }

    const trustedFolders = config.getTrustedFolders();
    const trusted = workspaceFolders.filter(folder => {
      return trustedFolders.some(trustedFolder => {
        const relative = path.relative(trustedFolder, folder);
        return relative === '' || (relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
      });
    });

    this.trustedFoldersCache = trusted;
    return trusted;
  }

  resetTrustedFoldersCache() {
    this.trustedFoldersCache = undefined;
  }
}
