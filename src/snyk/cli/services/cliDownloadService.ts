import { ReplaySubject } from 'rxjs';
import { IConfiguration } from '../../common/configuration/configuration';
import { MEMENTO_CLI_CHECKSUM, MEMENTO_CLI_LAST_UPDATE_DATE } from '../../common/constants/globalState';
import { ILog } from '../../common/logger/interfaces';
import { Platform } from '../../common/platform';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeWindow } from '../../common/vscode/window';
import { IStaticCliApi } from '../api/staticCliApi';
import { Checksum } from '../checksum';
import { CliExecutable } from '../cliExecutable';
import { CliDownloader } from '../downloader';
import { messages } from '../messages/messages';
import { CliSupportedPlatform, isPlatformSupported } from '../supportedPlatforms';

export class CliDownloadService {
  readonly downloadFinished$ = new ReplaySubject<void>(1);
  private readonly downloader: CliDownloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly configuration: IConfiguration,
    private readonly api: IStaticCliApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: CliDownloader,
  ) {
    this.downloader =
      downloader ?? new CliDownloader(configuration, api, extensionContext.extensionPath, window, logger);
  }

  async downloadOrUpdateCli(): Promise<boolean> {
    const installed = await this.isInstalled();

    if (!this.configuration.isAutomaticDependencyManagementEnabled()) {
      return false;
    }

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

    await this.setLastUpdateDateAndChecksum(executable.checksum);
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async updateCli(): Promise<boolean> {
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

      await this.setLastUpdateDateAndChecksum(executable.checksum);
      this.logger.info(messages.updateFinished(executable.version));
      return true;
    } else {
      this.logger.info(messages.isLatest);
      return false;
    }
  }

  async isInstalled(): Promise<boolean> {
    const executableExists = await CliExecutable.exists(this.extensionContext.extensionPath);
    const lastUpdateDateWritten = !!this.getLastCliUpdateDate();
    const cliChecksumWritten = !!this.getCliChecksum();

    return executableExists && lastUpdateDateWritten && cliChecksumWritten;
  }

  private async isUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const latestChecksum = await this.api.getSha256Checksum(platform);
    const path = CliExecutable.getPath(this.extensionContext.extensionPath, this.configuration.getCustomCliPath());

    // Update is available if fetched checksum not matching the current one
    const checksum = await Checksum.getChecksumOf(path, latestChecksum);
    if (checksum.verify()) {
      this.logger.info(messages.isLatest);
      return false;
    }

    return true;
  }

  private async setLastUpdateDateAndChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_LAST_UPDATE_DATE, Date.now());
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_CHECKSUM, checksum.checksum);
  }

  private isFourDaysPassedSinceLastUpdate(): boolean {
    const lastUpdateDate = this.getLastCliUpdateDate();
    if (!lastUpdateDate) {
      throw new Error('Last update date is not known.');
    }

    const fourDaysInMs = 4 * 24 * 3600 * 1000;
    if (Date.now() - lastUpdateDate > fourDaysInMs) {
      return true;
    }

    return false;
  }

  private getLastCliUpdateDate(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_LAST_UPDATE_DATE);
  }

  private getCliChecksum(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_CHECKSUM);
  }
}
