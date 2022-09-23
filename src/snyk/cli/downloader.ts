import axios, { CancelTokenSource } from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as stream from 'stream';
import { IConfiguration } from '../common/configuration/configuration';
import { LsExecutable } from '../common/languageServer/lsExecutable';
import { ILog } from '../common/logger/interfaces';
import { Platform } from '../common/platform';
import { IVSCodeWindow } from '../common/vscode/window';
import { IStaticCliApi } from './api/staticCliApi';
import { IStaticLsApi } from './api/staticLsApi';
import { Checksum } from './checksum';
import { CliExecutable } from './cliExecutable';
import { messages } from './messages/messages';
import { CliSupportedPlatform, isPlatformSupported, LsSupportedPlatform } from './supportedPlatforms';
import { Progress } from 'vscode';
import { CancellationToken } from '../common/vscode/types';

export type DownloadAxiosResponse = { data: stream.Readable; headers: { [header: string]: unknown } };

export class Downloader {
  constructor(
    private readonly configuration: IConfiguration,
    private readonly cliApi: IStaticCliApi,
    private readonly lsApi: IStaticLsApi,
    private readonly extensionDir: string,
    private readonly window: IVSCodeWindow,
    private readonly logger: ILog,
  ) {}

  /**
   * Downloads CLI or LS to the extension folder. Existing executable is deleted.
   */
  async download(): Promise<CliExecutable | LsExecutable | null> {
    let platform = Platform.getCurrent();
    if (!isPlatformSupported(platform)) {
      return Promise.reject(messages.notSupported);
    }

    if (!this.configuration.getPreviewFeatures().lsAuthenticate) {
      platform = platform as CliSupportedPlatform;
      return await this.getCliExecutable(platform);
    } else {
      const lsPlatform = Platform.getCurrentWithArch();
      return await this.getLsExecutable(lsPlatform);
    }
  }

  private async getLsExecutable(lsPlatform: LsSupportedPlatform) {
    const lsPath = LsExecutable.getPath(this.extensionDir, this.configuration.getCustomLsPath());
    if (await this.binaryExists(lsPath)) {
      await this.deleteFileAtPath(lsPath);
    }

    const lsVersion = await this.lsApi.getMetadata().then(metadata => metadata.version);
    const sha256 = await this.lsApi.getSha256Checksum(lsPlatform);
    const checksum = await this.downloadLs(lsPath, lsPlatform, sha256);

    if (!checksum) {
      return null;
    }

    const checksumCorrect = checksum.verify();
    if (!checksumCorrect) {
      return Promise.reject(messages.integrityCheckFailed);
    }

    return new LsExecutable(lsVersion, checksum);
  }

  private async getCliExecutable(platform: 'darwin' | 'linux' | 'win32') {
    const cliPath = CliExecutable.getPath(this.extensionDir, this.configuration.getCustomCliPath());
    if (await this.binaryExists(cliPath)) {
      await this.deleteFileAtPath(cliPath);
    }

    const cliVersion = await this.cliApi.getLatestVersion();
    const sha256 = await this.cliApi.getSha256Checksum(platform);
    const checksum = await this.downloadCli(cliPath, platform, sha256);

    if (!checksum) {
      return null;
    }

    const checksumCorrect = checksum.verify();
    if (!checksumCorrect) {
      return Promise.reject(messages.integrityCheckFailed);
    }

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

  public async downloadLs(
    lsPath: string,
    platform: LsSupportedPlatform,
    expectedChecksum: string,
  ): Promise<Checksum | null> {
    const hash = new Checksum(expectedChecksum);

    return this.window.withProgress(messages.progressTitle, async (progress, token) => {
      const [request, requestToken]: [response: Promise<DownloadAxiosResponse>, cancelToken: CancelTokenSource] =
        await this.lsApi.downloadBinary(platform);

      token.onCancellationRequested(async () => {
        requestToken.cancel();
        this.logger.info(messages.downloadCanceled);
        await this.deleteFileAtPath(lsPath);
      });

      progress.report({ increment: 0 });
      return await this.doDownload(requestToken, token, lsPath, request, hash, progress);
    });
  }

  private async doDownload(
    requestToken: CancelTokenSource,
    token: CancellationToken,
    path: string,
    request: Promise<DownloadAxiosResponse>,
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
      if (axios.isCancel(err)) {
        return null;
      }

      throw err;
    }
  }

  // TODO: remove after feature flag is removed
  public async downloadCli(
    cliPath: string,
    platform: CliSupportedPlatform,
    expectedChecksum: string,
  ): Promise<Checksum | null> {
    const hash = new Checksum(expectedChecksum);

    return this.window.withProgress(messages.progressTitle, async (progress, token) => {
      const [request, requestToken]: [response: Promise<DownloadAxiosResponse>, cancelToken: CancelTokenSource] =
        this.cliApi.getExecutable(platform);
      return await this.doDownload(requestToken, token, cliPath, request, hash, progress);
    });
  }
}
