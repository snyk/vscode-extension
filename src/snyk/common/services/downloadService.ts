import { ReplaySubject } from 'rxjs';
import { Checksum } from '../../cli/checksum';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { MEMENTO_CLI_CHECKSUM, MEMENTO_CLI_VERSION } from '../constants/globalState';
import { Downloader } from '../download/downloader';
import { CliExecutable } from '../../cli/cliExecutable';
import { IStaticCliApi } from '../../cli/staticCliApi';
import { ILog } from '../logger/interfaces';
import { ExtensionContext } from '../vscode/extensionContext';
import { IVSCodeWindow } from '../vscode/window';
import { CliSupportedPlatform } from '../../cli/supportedPlatforms';

export class DownloadService {
  readonly downloadReady$ = new ReplaySubject<void>(1);
  private readonly downloader: Downloader;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly configuration: IConfiguration,
    private readonly lsApi: IStaticCliApi,
    readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    downloader?: Downloader,
  ) {
    this.downloader = downloader ?? new Downloader(configuration, lsApi, window, logger, this.extensionContext);
  }

  async downloadOrUpdate(): Promise<boolean> {
    const lsInstalled = await this.isCliInstalled();
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

    await this.setCliChecksum(executable.checksum);
    await this.setCliVersion(executable.version);
    this.logger.info(messages.downloadFinished(executable.version));
    return true;
  }

  async update(): Promise<boolean> {
    const platform = await CliExecutable.getCurrentWithArch();
    const version = await this.lsApi.getLatestCliVersion(this.configuration.getCliReleaseChannel());
    const lsInstalled = await this.isCliInstalled();
    const cliVersionHasUpdated = this.hasCliVersionUpdated(version);
    const needsUpdate = cliVersionHasUpdated;
    if (!lsInstalled || needsUpdate) {
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
      this.logger.info(messages.downloadFinished(executable.version));
      return true;
    }
    return false;
  }

  async isCliInstalled() {
    const lsExecutableExists = await CliExecutable.exists(
      this.extensionContext.extensionPath,
      await this.configuration.getCliPath(),
    );
    const lsChecksumWritten = !!this.getCliChecksum();

    return lsExecutableExists && lsChecksumWritten;
  }

  private async isCliUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const version = await this.lsApi.getLatestCliVersion(this.configuration.getCliReleaseChannel());
    const latestChecksum = await this.lsApi.getSha256Checksum(version, platform);
    const path = await CliExecutable.getPath(
      this.extensionContext.extensionPath,
      await this.configuration.getCliPath(),
    );

    // Update is available if fetched checksum not matching the current one
    const checksum = await Checksum.getChecksumOf(path, latestChecksum);
    if (checksum.verify()) {
      this.logger.info(messages.isLatest);
      return false;
    }

    return true;
  }

  private async setCliChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_CHECKSUM, checksum.checksum);
  }

  private async setCliVersion(cliVersion: string): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_VERSION, cliVersion);
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
