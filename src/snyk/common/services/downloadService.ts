import { ReplaySubject } from 'rxjs';
import * as fsPromises from 'fs/promises';
import { Checksum } from '../../cli/checksum';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { MEMENTO_CLI_CHECKSUM, MEMENTO_CLI_VERSION, MEMENTO_LS_PROTOCOL_VERSION } from '../constants/globalState';
import { Downloader } from '../download/downloader';
import { CliExecutable } from '../../cli/cliExecutable';
import { IStaticCliApi } from '../../cli/staticCliApi';
import { ILog } from '../logger/interfaces';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeWindow } from '../vscode/window';
import { CliSupportedPlatform } from '../../cli/supportedPlatforms';
import { PROTOCOL_VERSION } from '../constants/languageServer';

export class DownloadService {
  readonly downloadReady$ = new ReplaySubject<void>(1);
  private readonly downloader: Downloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly configuration: IConfiguration,
    private readonly cliApi: IStaticCliApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: Downloader,
  ) {
    this.downloader = downloader ?? new Downloader(configuration, cliApi, window, logger, this.extensionContext);
  }

  async downloadOrUpdate(): Promise<boolean> {
    const cliInstalled = await this.isCliInstalled();
    if (!this.configuration.isAutomaticDependencyManagementEnabled()) {
      this.downloadReady$.next();
      return false;
    }

    if (!cliInstalled) {
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

    await this.setCliChecksum(executable.checksum);
    await this.setCliVersion(executable.version);
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async update(): Promise<boolean> {
    const platform = await CliExecutable.getCurrentWithArch();
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const version = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    if (!version) {
      return false;
    }
    const cliInstalled = await this.isCliInstalled();
    const cliVersionHasUpdated = this.hasCliVersionUpdated(version);
    const needsUpdate = cliVersionHasUpdated || this.hasLspVersionUpdated();
    if (!cliInstalled || needsUpdate) {
      const updateAvailable = await this.isCliUpdateAvailable(platform);
      if (!updateAvailable) {
        return false;
      }
      const executable = await this.downloader.download();
      if (!executable) {
        return false;
      }

      await this.setCliChecksum(executable.checksum);
      await this.setCliVersion(executable.version);
      await this.setCurrentLspVersion();
      this.logger.info(messages.downloadFinished(executable.version));
      return true;
    }
    return false;
  }

  async isCliInstalled() {
    const cliExecutableExists = await CliExecutable.exists(await this.configuration.getCliPath());
    const cliChecksumWritten = !!this.getCliChecksum();

    return cliExecutableExists && cliChecksumWritten;
  }

  private async isCliUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const version = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    if (!version) {
      return false;
    }
    const latestChecksum = await this.cliApi.getSha256Checksum(version, platform);
    const path = await this.configuration.getCliPath();
    // migration for moving from default extension path to xdg dirs.
    if (CliExecutable.isPathInExtensionDirectory(this.extensionContext.extensionPath, path)) {
      try {
        await fsPromises.unlink(path);
      } catch {
        // eslint-disable-next-line no-empty
      }
      await this.configuration.setCliPath(await CliExecutable.getPath());
      return true;
    }
    // Update is available if fetched checksum not matching the current one
    try {
      const checksum = await Checksum.getChecksumOf(path, latestChecksum);
      if (checksum.verify()) {
        this.logger.info(messages.isLatest);
        return false;
      }
    } catch {
      // if checksum check fails; force an update
      return true;
    }

    return true;
  }

  private async setCliChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_CHECKSUM, checksum.checksum);
  }

  private async setCliVersion(cliVersion: string): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_VERSION, cliVersion);
  }

  private hasLspVersionUpdated(): boolean {
    const currentProtoclVersion = this.getLsProtocolVersion();
    return currentProtoclVersion != PROTOCOL_VERSION;
  }

  private async setCurrentLspVersion(): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_PROTOCOL_VERSION, PROTOCOL_VERSION);
  }

  private getLsProtocolVersion() {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_PROTOCOL_VERSION);
  }

  private hasCliVersionUpdated(cliVersion: string): boolean {
    const currentVersion = this.getCliVersion();
    return currentVersion != cliVersion;
  }

  private getCliVersion(): string | undefined {
    return this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_VERSION);
  }

  private getCliChecksum(): string | undefined {
    return this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_CHECKSUM);
  }
}
