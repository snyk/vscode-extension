import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import axios, { CancelTokenSource } from 'axios';
import * as stream from 'stream';
import { Platform } from '../common/platform';
import { CliExecutable } from './cliExecutable';
import { CliDownloadAxiosResponse, IStaticCliApi } from './api/staticCliApi';
import { ILog } from '../common/logger/interfaces';
import { IVSCodeWindow } from '../common/vscode/window';
import { Checksum } from './checksum';
import { messages } from './messages/messages';
import { isPlatformSupported, CliSupportedPlatform } from './supportedPlatforms';

export class CliDownloader {
  constructor(
    private readonly api: IStaticCliApi,
    private readonly extensionDir: string,
    private readonly window: IVSCodeWindow,
    private readonly logger: ILog,
  ) {}

  /**
   * Downloads CLI to the extension folder. Existing executable is deleted.
   */
  async download(): Promise<CliExecutable | null> {
    let platform = Platform.getCurrent();

    if (!isPlatformSupported(platform)) {
      return Promise.reject(messages.notSupported);
    }

    platform = platform as CliSupportedPlatform;

    const cliPath = CliExecutable.getPath(this.extensionDir);
    if (await this.cliExists(cliPath)) {
      await this.deleteCli(cliPath);
    }

    const cliVersion = await this.api.getLatestVersion();
    const sha256 = await this.api.getSha256Checksum(platform);
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

  private async cliExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async deleteCli(filePath: string): Promise<void> {
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
      const [request, requestToken]: [
        response: Promise<CliDownloadAxiosResponse>,
        cancelToken: CancelTokenSource,
      ] = this.api.getExecutable(platform);

      token.onCancellationRequested(async () => {
        requestToken.cancel();
        this.logger.info(messages.downloadCanceled);
        await this.deleteCli(cliPath);
      });

      progress.report({ increment: 0 });

      const writer = fs.createWriteStream(cliPath, {
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
    });
  }
}
