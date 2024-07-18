import { FolderConfig, IConfiguration } from './configuration';

export interface IFolderConfigs {
  getFolderConfigs(config: IConfiguration): ReadonlyArray<FolderConfig>;

  resetFolderConfigsCache(): void;
}

export class FolderConfigs implements IFolderConfigs {
  private folderConfigsCache?: ReadonlyArray<FolderConfig>;

  getFolderConfigs(config: IConfiguration): ReadonlyArray<FolderConfig> {
    if (this.folderConfigsCache !== undefined) {
      return this.folderConfigsCache;
    }

    const folderConfigs = config.getFolderConfigs();

    this.folderConfigsCache = folderConfigs;

    return folderConfigs;
  }

  setFolderConfig(_config: IConfiguration, _folderPath: string, _baseBranch: string) {
    // Get all folders and update one you need and use setFolderConfig.
    // if (this.folderConfigsCache !== undefined) {
    //   return this.folderConfigsCache;
    // }

    // const folderConfigs = config.getFolderConfigs();

    // this.folderConfigsCache = folderConfigs;

    // return folderConfigs;
  }

  resetFolderConfigsCache() {
    this.folderConfigsCache = undefined;
  }
}
