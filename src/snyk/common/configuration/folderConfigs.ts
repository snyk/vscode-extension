import { IVSCodeWindow } from '../vscode/window';
import { FolderConfig, IConfiguration } from './configuration';

export interface IFolderConfigs {
  getFolderConfigs(config: IConfiguration): ReadonlyArray<FolderConfig>;
  getFolderConfig(config: IConfiguration, folderPath: string): FolderConfig | undefined;
  setFolderConfig(config: IConfiguration, folderConfig: FolderConfig): void;
  //setBranch(config: IConfiguration, folderPath: string, branchName: string): void;
  resetFolderConfigsCache(): void;
}

export class FolderConfigs implements IFolderConfigs {
  private folderConfigsCache?: ReadonlyArray<FolderConfig>;

  getFolderConfig(config: IConfiguration, folderPath: string): FolderConfig | undefined {
    const folderConfigs = this.getFolderConfigs(config);
    return folderConfigs.find(i => i.folderPath === folderPath);
  }

  getFolderConfigs(config: IConfiguration): ReadonlyArray<FolderConfig> {
    if (this.folderConfigsCache !== undefined) {
      return this.folderConfigsCache;
    }
    const folderConfigs = config.getFolderConfigs();
    this.folderConfigsCache = folderConfigs;

    return folderConfigs;
  }

  // async setBranch(window: IVSCodeWindow, config: IConfiguration, folderPath: string) : Promise<void> {
  //   const branchName = await window.showInputBox({
  //     placeHolder: '',
  //     // validateInput: _input => {
  //     //   return;
  //     // },
  //   });
  //   let folderConfig = this.getFolderConfig(config, folderPath);
  //   if (!folderConfig || !branchName) {
  //     return;
  //   }
  //   folderConfig.baseBranch = branchName;
  //   this.setFolderConfig(config, folderConfig);
  // }

  setFolderConfig(config: IConfiguration, folderConfig: FolderConfig){
    const currentFolderConfigs = this.getFolderConfigs(config);
    const finalFolderConfigs = currentFolderConfigs.map(i => i.folderPath === folderConfig.folderPath ? folderConfig : i);
    config.setFolderConfigs(finalFolderConfigs);
  }

  resetFolderConfigsCache() {
    this.folderConfigsCache = undefined;
  }
}
