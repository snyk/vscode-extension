import { IConfiguration } from './configuration';

import path from 'path';

export function getTrustedFolders(config: IConfiguration, workspaceFolders: string[]): string[] {
  const trustedFolders = config.getTrustedFolders();
  return workspaceFolders.filter(folder => {
    return trustedFolders.some(trustedFolder => {
      const relative = path.relative(trustedFolder, folder);
      return relative === '' || (relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
    });
  });
}
