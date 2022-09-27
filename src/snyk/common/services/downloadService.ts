import { ReplaySubject } from 'rxjs';
import { IConfiguration } from '../configuration/configuration';
import {
  MEMENTO_CLI_CHECKSUM,
  MEMENTO_CLI_LAST_UPDATE_DATE,
  MEMENTO_LS_CHECKSUM,
  MEMENTO_LS_LAST_UPDATE_DATE,
} from '../constants/globalState';
import { ILog } from '../logger/interfaces';
import { Platform } from '../platform';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeWindow } from '../vscode/window';
import { IStaticCliApi } from '../../cli/api/staticCliApi';
import { Checksum } from '../../cli/checksum';
import { CliExecutable } from '../../cli/cliExecutable';
import { Downloader } from '../download/downloader';
import { messages } from '../../cli/messages/messages';
import { CliSupportedPlatform, isPlatformSupported } from '../../cli/supportedPlatforms';
import { LsExecutable } from '../languageServer/lsExecutable';
import { IStaticLsApi } from '../languageServer/staticLsApi';
import { LsSupportedPlatform } from '../languageServer/supportedPlatforms';

export class DownloadService {
  readonly fourDaysInMs = 4 * 24 * 3600 * 1000;
  readonly downloadReady$ = new ReplaySubject<void>(1);

  private readonly downloader: Downloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly configuration: IConfiguration,
    private readonly cliApi: IStaticCliApi,
    private readonly lsApi: IStaticLsApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: Downloader,
  ) {
    this.downloader =
      downloader ?? new Downloader(configuration, cliApi, lsApi, extensionContext.extensionPath, window, logger);
  }

  private readonly featureFlagLsAuthenticateActive = this.configuration.getPreviewFeatures().lsAuthenticate;

  async downloadOrUpdate(): Promise<boolean> {
    const cliInstalled = await this.isCliInstalled();
    const lsInstalled = await this.isLsInstalled();

    if (!this.configuration.isAutomaticDependencyManagementEnabled()) {
      this.downloadReady$.next();
      return false;
    }

    const download =
      (this.featureFlagLsAuthenticateActive && !lsInstalled) ||
      (!this.featureFlagLsAuthenticateActive && !cliInstalled);

    if (download) {
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

    if (!this.featureFlagLsAuthenticateActive) {
      await this.setLastUpdateDateAndChecksum(executable.checksum);
    } else {
      await this.setLastLsUpdateDateAndChecksum(executable.checksum);
    }
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async update(): Promise<boolean> {
    if (!this.featureFlagLsAuthenticateActive) {
      const platform = Platform.getCurrent();
      if (!isPlatformSupported(platform)) {
        return Promise.reject(messages.notSupported);
      }
      if (this.isFourDaysPassedSinceLastCliUpdate()) {
        const updateAvailable = await this.isCliUpdateAvailable(platform as CliSupportedPlatform);
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
    } else {
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
  }

  async isCliInstalled(): Promise<boolean> {
    const executableExists = await CliExecutable.exists(this.extensionContext.extensionPath);
    const lastUpdateDateWritten = !!this.getLastCliUpdateDate();
    const cliChecksumWritten = !!this.getCliChecksum();

    return executableExists && lastUpdateDateWritten && cliChecksumWritten;
  }

  async isLsInstalled() {
    const lsExecutableExists = await LsExecutable.exists(this.configuration);
    const lastUpdateDateWritten = !!this.getLastLsUpdateDate();
    const lsChecksumWritten = !!this.getLsChecksum();

    return lsExecutableExists && lastUpdateDateWritten && lsChecksumWritten;
  }

  private async isCliUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const latestChecksum = await this.cliApi.getSha256Checksum(platform);
    const path = CliExecutable.getPath(this.extensionContext.extensionPath, this.configuration.getCustomCliPath());

    // Update is available if fetched checksum not matching the current one
    const checksum = await Checksum.getChecksumOf(path, latestChecksum);
    if (checksum.verify()) {
      this.logger.info(messages.isLatest);
      return false;
    }

    return true;
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

  private async setLastUpdateDateAndChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_LAST_UPDATE_DATE, Date.now());
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_CHECKSUM, checksum.checksum);
  }

  private async setLastLsUpdateDateAndChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_LAST_UPDATE_DATE, Date.now());
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_CHECKSUM, checksum.checksum);
  }

  private isFourDaysPassedSinceLastCliUpdate(): boolean {
    const lastUpdateDate = this.getLastCliUpdateDate();
    if (!lastUpdateDate) {
      throw new Error('Last update date is not known.');
    }

    return Date.now() - lastUpdateDate > this.fourDaysInMs;
  }

  private isFourDaysPassedSinceLastLsUpdate(): boolean {
    const lastUpdateDate = this.getLastLsUpdateDate();
    if (!lastUpdateDate) {
      throw new Error('Last update date is not known.');
    }
    return Date.now() - lastUpdateDate > this.fourDaysInMs;
  }

  private getLastCliUpdateDate(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_LAST_UPDATE_DATE);
  }

  private getLastLsUpdateDate() {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_LAST_UPDATE_DATE);
  }

  private getCliChecksum(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_CLI_CHECKSUM);
  }

  private getLsChecksum(): number | undefined {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_CHECKSUM);
  }
}
