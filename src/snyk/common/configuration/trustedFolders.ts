import { IConfiguration } from './configuration';

export function getTrustedFolders(config: IConfiguration, workspaceFolders: string[]): string[] {
  const trustedFolders = config.getTrustedFolders();

  return workspaceFolders.filter(folder => trustedFolders.includes(folder));
}
