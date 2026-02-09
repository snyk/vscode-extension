import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as stream from 'stream';
import { mkdirSync } from 'fs';
import { Progress } from 'vscode';
import { Checksum } from '../../cli/checksum';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { IStaticCliApi, CancelToken, DownloadResponse } from '../../cli/staticCliApi';
import { CliExecutable } from '../../cli/cliExecutable';
import { ILog } from '../logger/interfaces';
import { CancellationToken } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { CliSupportedPlatform } from '../../cli/supportedPlatforms';
import { ExtensionContext } from '../vscode/extensionContext';
import { ERRORS } from '../constants/errors';

export class Downloader {
  constructor(
    private readonly configuration: IConfiguration,
    private readonly cliApi: IStaticCliApi,
    private readonly window: IVSCodeWindow,
    private readonly logger: ILog,
    private readonly extensionContext: ExtensionContext,
  ) {}
  /**
   * Downloads CLI. Existing executable is deleted.
   */
  async download(): Promise<CliExecutable | null> {
    try {
      const platform = await CliExecutable.getCurrentWithArch();
      this.logger.info(`Detected platform: ${platform}.`);
      if (platform === null) {
        this.logger.error('Cannot download CLI: the current operating system/architecture is not supported.');
        return Promise.reject(!messages.notSupported);
      }
      return await this.getCliExecutable(platform);
    } catch (e) {
      this.logger.error(`CLI download failed: ${e instanceof Error ? e.message : e}`);
      throw new Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  private async getCliExecutable(platform: CliSupportedPlatform): Promise<CliExecutable | null> {
    const cliPath = await this.configuration.getCliPath();
    const cliDir = path.dirname(cliPath);
    this.logger.info(`Downloading CLI to "${cliPath}" (directory: "${cliDir}") for platform ${platform}.`);

    mkdirSync(cliDir, { recursive: true });
    const existingBinary = await this.binaryExists(cliPath);
    this.logger.info(`Existing CLI binary at download path: ${existingBinary}.`);
    if (existingBinary) {
      this.logger.info('Removing existing CLI binary before downloading the new version.');
      await this.deleteFileAtPath(cliPath);
    }

    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const cliVersion = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    this.logger.info(`Resolved CLI version ${cliVersion} from "${cliReleaseChannel}" release channel.`);

    const sha256 = await this.cliApi.getSha256Checksum(cliVersion, platform);
    this.logger.info(`Expected SHA-256 checksum for download: ${sha256}.`);

    this.logger.info('Initiating CLI binary download.');
    const checksum = await this.downloadCli(cliPath, platform, sha256);

    if (!checksum) {
      this.logger.error(
        'No checksum was returned from the download — this means the download failed or was cancelled.',
      );
      return null;
    }

    const checksumCorrect = checksum.verify();
    this.logger.info(
      `Download integrity check: actual checksum ${checksum.checksum}, expected ${sha256}, match: ${checksumCorrect}.`,
    );
    if (!checksumCorrect) {
      return Promise.reject(messages.integrityCheckFailed);
    }

    this.logger.info(`Successfully downloaded CLI version ${cliVersion}.`);
    return new CliExecutable(cliVersion, checksum);
  }

  private async binaryExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async deleteFileAtPath(filePath: string): Promise<void> {
    try {
      await fsPromises.unlink(filePath);
    } catch (err) {
      return Promise.reject(`${messages.couldNotDeleteExecutable} ${err}`);
    }
  }

  public async downloadCli(
    cliPath: string,
    platform: CliSupportedPlatform,
    expectedChecksum: string,
  ): Promise<Checksum | null> {
    const hash = new Checksum(expectedChecksum);

    return this.window.withProgress(messages.progressTitle, async (progress, token) => {
      const [request, requestToken]: [response: Promise<DownloadResponse>, cancelToken: CancelToken] =
        await this.cliApi.downloadBinary(platform);

      token.onCancellationRequested(async () => {
        requestToken.cancel();
        this.logger.info(messages.downloadCanceled);
        await this.deleteFileAtPath(cliPath);
      });

      progress.report({ increment: 0 });
      return await this.doDownload(requestToken, token, cliPath, request, hash, progress);
    });
  }

  private async doDownload(
    requestToken: CancelToken,
    token: CancellationToken,
    path: string,
    request: Promise<DownloadResponse>,
    hash: Checksum,
    progress: Progress<{ message?: string; increment?: number }>,
  ): Promise<Checksum | null> {
    token.onCancellationRequested(async () => {
      requestToken.cancel();
      this.logger.info(messages.downloadCanceled);
      await this.deleteFileAtPath(path);
    });

    progress.report({ increment: 0 });
    const writer = fs.createWriteStream(path, {
      mode: 0o766,
    });

    let lastPercentCompleted = 0;

    try {
      const { data, headers }: { data: stream.Readable; headers: { [header: string]: unknown } } = await request;

      const contentLength = headers['content-length'] as number;
      let downloadedBytes = 0;

      data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const percentCompleted = Math.floor((downloadedBytes / contentLength) * 100);
        const increment = percentCompleted - lastPercentCompleted;
        lastPercentCompleted = percentCompleted;

        hash.update(chunk);

        progress.report({ increment: increment });
      });

      data.pipe(writer);

      return new Promise((resolve, reject) => {
        data.on('end', () => {
          stream.finished(writer, err => {
            if (err) {
              reject(err);
            } else {
              resolve(hash.digest());
            }
          });
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Request cancelled') {
        return null;
      }

      throw err;
    }
  }
}
