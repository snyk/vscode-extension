// import { CliDownloader } from './downloader';
// import { CliExecutable } from './cliExecutable';
// import { ExtensionContext } from '../common/vscode/extensionContext';
// import { MEMENTO_CLI_LAST_UPDATE_DATE, MEMENTO_CLI_VERSION_KEY } from '../common/constants/globalState';
// import { IStaticCliApi } from './api/staticCliApi';
// import { ILog } from '../common/logger/interfaces';
// import { IVSCodeWindow } from '../common/vscode/window';
// import { CliVersion } from './version';
// import { messages } from './constants/messages';

// export class CliDownloadService {
//   private readonly downloader: CliDownloader;

//   constructor(
//     private readonly extensionContext: ExtensionContext,
//     private readonly api: IStaticCliApi,
//     readonly window: IVSCodeWindow,
//     private readonly logger: ILog,
//     downloader?: CliDownloader,
//   ) {
//     this.downloader = downloader ?? new CliDownloader(api, extensionContext.extensionPath, window, logger);
//   }

//   async downloadOrUpdateCli(): Promise<boolean> {
//     const installed = await this.isInstalled();
//     if (!installed) {
//       return this.downloadCli();
//     }

//     return this.updateCli();
//   }

//   async downloadCli(): Promise<boolean> {
//     this.logger.info(messages.startingDownload);
//     const executable = await this.downloader.download();
//     if (!executable) {
//       return false;
//     }

//     await this.setLatestVersion(executable.version);
//     this.logger.info(messages.downloadFinished(executable.version));
//     return true;
//   }

//   async updateCli(): Promise<boolean> {
//     // TODO: check if scan not running
//     if (this.isFourDaysPassedSinceLastUpdate()) {
//       const [currentVersion, latestVersion] = await this.getCurrentAndLatestVersion();
//       if (currentVersion.isLatest(latestVersion)) {
//         return false;
//       }

//       this.logger.info(messages.startingUpdate);
//       const executable = await this.downloader.download();

//       if (!executable) {
//         return false;
//       }

//       await this.setLatestVersion(executable.version);
//       this.logger.info(messages.updateFinished(executable.version));
//       return true;
//     } else {
//       this.logger.info(messages.isLatest);
//       return false;
//     }
//   }

//   async isInstalled(): Promise<boolean> {
//     return CliExecutable.exists(this.extensionContext.extensionPath);
//   }

//   private async setLatestVersion(version: string): Promise<void> {
//     await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_LAST_UPDATE_DATE, Date.now());
//     await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_VERSION_KEY, version);
//   }

//   private isFourDaysPassedSinceLastUpdate(): boolean {
//     const lastUpdateDate = this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_LAST_UPDATE_DATE);
//     if (!lastUpdateDate) {
//       throw new Error('Last update date is not known.');
//     }

//     const fourDaysInMs = 4 * 24 * 3600 * 1000;
//     if (Date.now() - lastUpdateDate > fourDaysInMs) {
//       return true;
//     }

//     return false;
//   }

//   private async getCurrentAndLatestVersion(): Promise<[currentVersion: CliVersion, latestVersion: CliVersion]> {
//     const latestVersion = await this.api.getLatestVersion();
//     const currentVersion = this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_VERSION_KEY);
//     if (!currentVersion) {
//       throw new Error('Current version is not known.');
//     }

//     return [new CliVersion(currentVersion), new CliVersion(latestVersion)];
//   }
// }
