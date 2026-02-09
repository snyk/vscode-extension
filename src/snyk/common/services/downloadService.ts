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
    this.logger.info('Starting CLI download or update check.');
    try {
      const cliInstalled = await this.isCliInstalled();
      const autoManagementEnabled = this.configuration.isAutomaticDependencyManagementEnabled();

      this.logger.info(
        `CLI installed: ${cliInstalled}, automatic dependency management enabled: ${autoManagementEnabled}.`,
      );

      if (!autoManagementEnabled) {
        this.logger.info(
          'Automatic dependency management is disabled — skipping CLI download/update. ' +
            'Enable "Automatic Dependency Management" in Snyk settings to allow automatic CLI updates.',
        );
        if (!cliInstalled) {
          throw new Error(
            'The Snyk CLI is not installed. Please download it manually or enable "Automatic Dependency Management" in Snyk settings.',
          );
        }
        return false;
      }

      if (!cliInstalled) {
        this.logger.info('CLI is not installed. Starting fresh download.');
        const freshDownloadsuccessStatus = await this.download();
        this.logger.info(`Fresh download completed successfully: ${freshDownloadsuccessStatus}.`);
        return freshDownloadsuccessStatus;
      }

      this.logger.info('CLI is already installed. Checking for available updates.');
      const cliReady = await this.update();
      this.logger.info(`Update check completed. CLI is ready: ${cliReady}.`);
      return cliReady;
    } finally {
      this.logger.info('CLI download/update check finished, signaling readiness to start Language Server.');
      this.downloadReady$.next();
    }
  }

  async download(): Promise<boolean> {
    this.logger.info(messages.startingDownload);
    this.logger.info('Initiating CLI binary download.');
    const executable = await this.downloader.download();
    if (!executable) {
      this.logger.error('CLI download did not produce an executable — the download may have failed or been cancelled.');
      return false;
    }

    this.logger.info(
      `CLI download successful: version ${executable.version}, checksum ${executable.checksum.checksum}.`,
    );
    await this.setCliChecksum(executable.checksum);
    await this.setCliVersion(executable.version);
    await this.setCurrentLspVersion();
    const message = `${messages.downloadFinished(executable.version)} Persisted CLI version ${
      executable.version
    } with protocol version ${PROTOCOL_VERSION}.`;
    this.logger.info(message);
    return true;
  }

  async update(): Promise<boolean> {
    const platform = await CliExecutable.getCurrentWithArch();
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    this.logger.info(`Checking for CLI updates on platform ${platform}, release channel "${cliReleaseChannel}".`);

    const version = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    if (!version) {
      this.logger.error(
        'The server did not return a CLI version — the version endpoint may be unavailable. Aborting update.',
      );
      return false;
    }
    this.logger.info(`Latest CLI version available from server: ${version}.`);

    const cliVersionHasUpdated = this.hasCliVersionUpdated(version);
    const lspVersionHasUpdated = this.hasLspVersionUpdated();
    const needsUpdate = cliVersionHasUpdated || lspVersionHasUpdated;

    this.logger.info(`Update decision: CLI version changed=${cliVersionHasUpdated}.`);
    this.logger.info(`Update decision: protocol version changed=${lspVersionHasUpdated}.`);
    this.logger.info(`Update decision: update needed=${needsUpdate}.`);

    if (needsUpdate) {
      this.logger.info('An update is needed. Verifying the update is available by comparing checksums.');
      const updateAvailable = await this.isCliUpdateAvailable(platform);
      if (!updateAvailable) {
        this.logger.info(
          'Local CLI binary checksum already matches the latest version on the server — no download required. ' +
            'Persisting current metadata to avoid redundant checks on next startup.',
        );
        await this.setCliVersion(version);
        await this.setCurrentLspVersion();
        return true;
      }

      this.logger.info('Update confirmed available. Starting CLI download.');
      const executable = await this.downloader.download();
      if (!executable) {
        this.logger.error(
          'CLI update download did not produce an executable — the download may have failed or been cancelled.',
        );
        return false;
      }

      await this.setCliChecksum(executable.checksum);
      await this.setCliVersion(executable.version);
      await this.setCurrentLspVersion();
      this.logger.info(messages.downloadFinished(executable.version));
      this.logger.info(
        `Persisted updated CLI: version ${executable.version}, checksum ${executable.checksum.checksum}, protocol ${PROTOCOL_VERSION}.`,
      );
      return true;
    }

    this.logger.info(
      'No update needed — CLI version and protocol version are both current. ' +
        `Installed version: ${this.getCliVersion()}, latest version: ${version}, ` +
        `stored protocol: ${this.getLsProtocolVersion()}, required protocol: ${PROTOCOL_VERSION}.`,
    );
    return true;
  }

  async isCliInstalled() {
    const cliPath = await this.configuration.getCliPath();
    const cliExecutableExists = await CliExecutable.exists(cliPath);
    const cliChecksumWritten = !!this.getCliChecksum();
    const installed = cliExecutableExists && cliChecksumWritten;

    this.logger.info(
      `CLI install check: path="${cliPath}", file exists on disk=${cliExecutableExists}, ` +
        `checksum stored from previous download=${cliChecksumWritten}, considered installed=${installed}.`,
    );

    return installed;
  }

  private async isCliUpdateAvailable(platform: CliSupportedPlatform): Promise<boolean> {
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    this.logger.info(
      `Checking if a CLI update is available for platform ${platform}, release channel "${cliReleaseChannel}".`,
    );

    const version = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    if (!version) {
      this.logger.error('The server did not return a CLI version — cannot determine if an update is available.');
      return false;
    }
    this.logger.info(`Latest version from server: ${version}.`);

    const latestChecksum = await this.cliApi.getSha256Checksum(version, platform);
    this.logger.info(`Server-side checksum for ${version} on ${platform}: ${latestChecksum}.`);

    const path = await this.configuration.getCliPath();
    // migration for moving from default extension path to xdg dirs.
    if (CliExecutable.isPathInExtensionDirectory(this.extensionContext.extensionPath, path)) {
      this.logger.info(
        `CLI binary at "${path}" is inside the old extension directory "${this.extensionContext.extensionPath}". ` +
          'Migrating to the standard data directory.',
      );
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
      this.logger.info(
        `Local CLI binary checksum: ${checksum.checksum}, ` +
          `server checksum: ${latestChecksum}, match: ${checksum.verify()}.`,
      );
      if (checksum.verify()) {
        this.logger.info(messages.isLatest);
        return false;
      }
    } catch (error) {
      // if checksum check fails; force an update
      this.logger.error(
        `Could not verify local CLI binary integrity (${
          error instanceof Error ? error.message : error
        }). Attempting to recover by forcing a re-download.`,
      );
      return true;
    }

    this.logger.info('Local CLI binary checksum does not match the server — an update is available.');
    return true;
  }

  private async setCliChecksum(checksum: Checksum): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_CHECKSUM, checksum.checksum);
  }

  private async setCliVersion(cliVersion: string): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_CLI_VERSION, cliVersion);
  }

  private hasLspVersionUpdated(): boolean {
    const storedProtocolVersion = this.getLsProtocolVersion();
    const updated = storedProtocolVersion != PROTOCOL_VERSION;
    this.logger.info(
      `Protocol version check: stored=${storedProtocolVersion}, required=${PROTOCOL_VERSION}, changed=${updated}.`,
    );
    return updated;
  }

  private async setCurrentLspVersion(): Promise<void> {
    await this.extensionContext.updateGlobalStateValue(MEMENTO_LS_PROTOCOL_VERSION, PROTOCOL_VERSION);
  }

  private getLsProtocolVersion() {
    return this.extensionContext.getGlobalStateValue<number>(MEMENTO_LS_PROTOCOL_VERSION);
  }

  private hasCliVersionUpdated(cliVersion: string): boolean {
    const storedVersion = this.getCliVersion();
    const updated = storedVersion != cliVersion;
    this.logger.info(`CLI version check: installed=${storedVersion}, latest=${cliVersion}, changed=${updated}.`);
    return updated;
  }

  private getCliVersion(): string | undefined {
    return this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_VERSION);
  }

  private getCliChecksum(): string | undefined {
    return this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_CHECKSUM);
  }

  /**
   * Verifies CLI integrity and redownloads if checksum doesn't match or file is corrupted.
   * Returns true if CLI is valid or was successfully redownloaded.
   */
  async verifyAndRepairCli(): Promise<boolean> {
    this.logger.info('Starting CLI integrity verification.');
    if (!this.configuration.isAutomaticDependencyManagementEnabled()) {
      this.logger.info(
        'Automatic dependency management is disabled — skipping CLI verification. ' +
          'Enable "Automatic Dependency Management" in Snyk settings to allow CLI integrity checks.',
      );
      return false;
    }

    try {
      const cliPath = await this.configuration.getCliPath();
      const platform = await CliExecutable.getCurrentWithArch();
      this.logger.info(`Verifying CLI at "${cliPath}" for platform ${platform}.`);

      if (!platform) {
        this.logger.error('Cannot verify CLI: the current platform is not supported.');
        return false;
      }

      // Check if CLI file exists
      const cliExists = await CliExecutable.exists(cliPath);
      this.logger.info(`CLI binary exists on disk: ${cliExists}.`);
      if (!cliExists) {
        this.logger.info('CLI binary not found on disk. Downloading a fresh copy.');
        return await this.download();
      }

      // Get the expected checksum for the current version
      const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
      const latestVersion = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
      const expectedChecksum = await this.cliApi.getSha256Checksum(latestVersion, platform);
      this.logger.info(`Expected CLI: version ${latestVersion}, checksum ${expectedChecksum}.`);

      // Verify the actual file checksum
      const actualChecksum = await Checksum.getChecksumOf(cliPath, expectedChecksum);
      this.logger.info(
        `Actual CLI binary checksum: ${actualChecksum.checksum}, matches expected: ${actualChecksum.verify()}.`,
      );

      if (actualChecksum.verify()) {
        this.logger.info('CLI integrity verification passed — binary is valid.');
        return true;
      } else {
        this.logger.error(
          'CLI integrity verification failed — the binary on disk does not match the expected checksum. Re-downloading.',
        );
        return await this.download();
      }
    } catch (error) {
      this.logger.error(`CLI verification encountered an error: ${error}`);
      this.logger.info('Attempting to recover by re-downloading the CLI.');
      try {
        return await this.download();
      } catch (downloadError) {
        this.logger.error(`CLI re-download also failed: ${downloadError}`);
        return false;
      }
    }
  }
}
