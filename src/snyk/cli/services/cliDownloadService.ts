import { CliDownloader } from '../downloader';
import { CliExecutable } from '../cliExecutable';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { MEMENTO_CLI_LAST_UPDATE_DATE } from '../../common/constants/globalState';
import { IStaticCliApi } from '../api/staticCliApi';
import { ILog } from '../../common/logger/interfaces';
import { IVSCodeWindow } from '../../common/vscode/window';
import { messages } from '../messages/messages';
import { Checksum } from '../checksum';
import { Platform } from '../../common/platform';
import { CliSupportedPlatform, isPlatformSupported } from '../supportedPlatforms';
import { ReplaySubject } from 'rxjs';

export class CliDownloadService {
  readonly downloadFinished$ = new ReplaySubject<void>(1);
  private readonly downloader: CliDownloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly api: IStaticCliApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: CliDownloader,
  ) {
    this.downloader = downloader ?? new CliDownloader(api, extensionContext.extensionPath, window, logger);
  }

  async downloadOrUpdateCli(): Promise<boolean> {
    const installed = await this.isInstalled();
    if (!installed) {
      const downloaded = await this.downloadCli();
      this.downloadFinished$.next();
      return downloaded;
    }

    const updated = await this.updateCli();
    this.downloadFinished$.next();

    return updated;
  }

  async downloadCli(): Promise<boolean> {
    this.logger.info(messages.startingDownload);
    const executable = await this.downloader.download();
    if (!executable) {
      return false;
    }

    await this.setLastUpdateDate();
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async updateCli(): Promise<boolean> {
    // TODO: check if scan not running
    if (this.isFourDaysPassedSinceLastUpdate()) {
      const platform = Platform.getCurrent();
      if (!isPlatformSupported(platform)) {
        return Promise.reject(messages.notSupported);
      }

      const updateAvailable = await this.isUpdateAvailable(platform as CliSupportedPlatform);
      if (!updateAvailable) {
        return false;
      }

      this.logger.info(messages.startingUpdate);
      const executable = await this.downloader.download();

      if (!executable) {
        return false;
      }

      await this.setLastUpdateDate();
      this.logger.info(messages.updateFinished(executable.version));
      return true;
    } else {
      this.logger.info(messages.isLatest);
      return false;
    }
  }

  async isInstalled(): Promise<boolean> {
    return CliExecutable.exists(this.extensionContext.extensionPath);
  }

  private async isUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const latestChecksum = await this.api.getSha256Checksum(platform);
    const path = CliExecutable.getPath(this.extensionContext.extensionPath);

    // Update is available if fetched checksum not matching the current one
    const checksum = await Checksum.getChecksumOf(path, latestChecksum);
    if (checksum.verify()) {
      this.logger.info(messages.isLatest);
      return false;
    }

    return true;
  }

  private async setLastUpdateDate(): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_LAST_UPDATE_DATE, Date.now());
  }

  private isFourDaysPassedSinceLastUpdate(): boolean {
    const lastUpdateDate = this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_LAST_UPDATE_DATE);
    if (!lastUpdateDate) {
      throw new Error('Last update date is not known.');
    }

    const fourDaysInMs = 4 * 24 * 3600 * 1000;
    if (Date.now() - lastUpdateDate > fourDaysInMs) {
      return true;
    }

    return false;
  }
}
