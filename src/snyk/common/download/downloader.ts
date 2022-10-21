import axios, { CancelTokenSource } from 'axios';
import * as fs from 'fs';
import { mkdirSync } from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';
import * as stream from 'stream';
import { Progress } from 'vscode';
import { Checksum } from '../../cli/checksum';
import { CliExecutable } from '../../cli/cliExecutable';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { LsExecutable } from '../languageServer/lsExecutable';
import { IStaticLsApi } from '../languageServer/staticLsApi';
import { LsSupportedPlatform } from '../languageServer/supportedPlatforms';
import { ILog } from '../logger/interfaces';
import { CancellationToken } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';

export type DownloadAxiosResponse = { data: stream.Readable; headers: { [header: string]: unknown } };

export class Downloader {
  constructor(
    private readonly configuration: IConfiguration,
    private readonly lsApi: IStaticLsApi,
    private readonly window: IVSCodeWindow,
    private readonly logger: ILog,
  ) {}

  /**
   * Downloads LS. Existing executable is deleted.
   */
  async download(): Promise<CliExecutable | LsExecutable | null> {
    const lsPlatform = LsExecutable.getCurrentWithArch();
    if (lsPlatform === null) {
      return Promise.reject(!messages.notSupported);
    }
    return await this.getLsExecutable(lsPlatform);
  }

  private async getLsExecutable(lsPlatform: LsSupportedPlatform): Promise<LsExecutable | null> {
    const lsPath = LsExecutable.getPath(this.configuration.getSnykLanguageServerPath());
    const lsDir = path.dirname(lsPath);
    mkdirSync(lsDir, { recursive: true });
    if (await this.binaryExists(lsPath)) {
      await this.deleteFileAtPath(lsPath);
    }

    const lsVersion = (await this.lsApi.getMetadata()).version;
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
}
