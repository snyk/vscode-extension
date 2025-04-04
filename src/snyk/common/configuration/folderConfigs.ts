import { IVSCodeWindow } from '../vscode/window';
import { FolderConfig, IConfiguration } from './configuration';

export interface IFolderConfigs {
  getFolderConfigs(config: IConfiguration): ReadonlyArray<FolderConfig>;

  getFolderConfig(config: IConfiguration, folderPath: string): FolderConfig | undefined;

  setFolderConfig(config: IConfiguration, folderConfig: FolderConfig): void;

  setBranch(window: IVSCodeWindow, config: IConfiguration, folderPath: string): Promise<void>;

  setReferenceFolder(window: IVSCodeWindow, config: IConfiguration, folderPath: string): Promise<void>;

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

  async setReferenceFolder(window: IVSCodeWindow, config: IConfiguration, folderPath: string): Promise<void> {
    const folderConfig = this.getFolderConfig(config, folderPath);

    if (!folderConfig) {
      return;
    }

    const selectedDir = await window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select a reference folder for net-new issue scanning',
    });

    if (!selectedDir || selectedDir.length != 1) {
      return;
    }

    folderConfig.referenceFolderPath = selectedDir[0].fsPath;
    folderConfig.baseBranch = '';
    this.setFolderConfig(config, folderConfig);
  }

  async setBranch(window: IVSCodeWindow, config: IConfiguration, folderPath: string): Promise<void> {
    const folderConfig = this.getFolderConfig(config, folderPath);

    if (!folderConfig) {
      return;
    }

    const branchName = await window.showInputBox({
      placeHolder: '',
      validateInput: input => {
        const valid = this.validateBranchName(input, folderConfig.localBranches ?? []);
        if (!valid) {
          return "The chosen branch name doesn't exist.";
        }
      },
    });
    if (!branchName) {
      return;
    }

    folderConfig.baseBranch = branchName;
    folderConfig.referenceFolderPath = '';
    this.setFolderConfig(config, folderConfig);
  }

  private validateBranchName(branchName: string, branchList: string[]): boolean {
    return branchList.includes(branchName);
  }

  setFolderConfig(config: IConfiguration, folderConfig: FolderConfig): void {
    const currentFolderConfigs = this.getFolderConfigs(config);
    const finalFolderConfigs = currentFolderConfigs.map(i =>
      i.folderPath === folderConfig.folderPath ? folderConfig : i,
    );
    config.setFolderConfigs(finalFolderConfigs);
    this.folderConfigsCache = finalFolderConfigs;
  }

  resetFolderConfigsCache() {
    this.folderConfigsCache = undefined;
  }
}
