import { IConfiguration } from './configuration';

export function getTrustedFolders(config: IConfiguration, workspaceFolders: string[]): string[] {
  const trustedFolders = config.getTrustedFolders();
  const path = require('path');

  return workspaceFolders.filter(folder => {
    return trustedFolders.some(trustedFolder => {
      const relative = path.relative(trustedFolder, folder);
      return relative && !relative.startsWith('..' + path.separator) && !path.isAbsolute(relative);
    });
  });
}
