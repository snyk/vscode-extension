import { ReplaySubject } from 'rxjs';
import { Checksum } from '../../cli/checksum';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { MEMENTO_LS_CHECKSUM, MEMENTO_LS_LAST_UPDATE_DATE } from '../constants/globalState';
import { Downloader } from '../download/downloader';
import { LsExecutable } from '../languageServer/lsExecutable';
import { IStaticLsApi } from '../languageServer/staticLsApi';
import { LsSupportedPlatform } from '../languageServer/supportedPlatforms';
import { ILog } from '../logger/interfaces';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeWindow } from '../vscode/window';

export class DownloadService {
  readonly fourDaysInMs = 4 * 24 * 3600 * 1000;
  readonly downloadReady$ = new ReplaySubject<void>(1);

  private readonly downloader: Downloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly configuration: IConfiguration,
    private readonly lsApi: IStaticLsApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: Downloader,
  ) {
    this.downloader = downloader ?? new Downloader(configuration, lsApi, window, logger);
  }

  async downloadOrUpdate(): Promise<boolean> {
    const lsInstalled = await this.isLsInstalled();
    if (!this.configuration.isAutomaticDependencyManagementEnabled()) {
      this.downloadReady$.next();
      return false;
    }

    if (!lsInstalled) {
      const downloaded = await this.download();
      this.downloadReady$.next();
      return downloaded;
    }

    const updated = await this.update();
    this.downloadReady$.next();

    return updated;
  }

  async download(): Promise<boolean> {
    this.logger.info(messages.startingDownload);
    const executable = await this.downloader.download();
    if (!executable) {
      return false;
    }

    await this.setLastLsUpdateDateAndChecksum(executable.checksum);
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async update(): Promise<boolean> {
    // let language server manage CLI downloads, but download LS here
    const platform = LsExecutable.getCurrentWithArch();
    const lsInstalled = await this.isLsInstalled();
    if (!lsInstalled || this.isFourDaysPassedSinceLastLsUpdate()) {
      const updateAvailable = await this.isLsUpdateAvailable(platform);
      if (!updateAvailable) {
        return false;
      }
      const executable = await this.downloader.download();
      if (!executable) {
        return false;
      }

      await this.setLastLsUpdateDateAndChecksum(executable.checksum);
      this.logger.info(messages.downloadFinished(executable.version));
      return true;
    }
    return false;
  }

  async isLsInstalled() {
    const lsExecutableExists = await LsExecutable.exists(this.configuration);
    const lastUpdateDateWritten = !!this.getLastLsUpdateDate();
    const lsChecksumWritten = !!this.getLsChecksum();

    return lsExecutableExists && lastUpdateDateWritten && lsChecksumWritten;
  }

  private async isLsUpdateAvailable(platform: LsSupportedPlatform): Promise<boolean> {
    const latestChecksum = await this.lsApi.getSha256Checksum(platform);
    const path = LsExecutable.getPath(this.configuration.getSnykLanguageServerPath());

    // Update is available if fetched checksum not matching the current one
    const checksum = await Checksum.getChecksumOf(path, latestChecksum);
    if (checksum.verify()) {
      this.logger.info(messages.isLatest);
      return false;
    }

    return true;
  }

  private async setLastLsUpdateDateAndChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_LAST_UPDATE_DATE, Date.now());
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_CHECKSUM, checksum.checksum);
  }

  private isFourDaysPassedSinceLastLsUpdate(): boolean {
    const lastUpdateDate = this.getLastLsUpdateDate();
    if (!lastUpdateDate) {
      throw new Error('Last update date is not known.');
    }
    return Date.now() - lastUpdateDate > this.fourDaysInMs;
  }

  private getLastLsUpdateDate() {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_LAST_UPDATE_DATE);
  }

  private getLsChecksum(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_CHECKSUM);
  }
}
