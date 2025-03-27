import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as stream from 'stream';
import { mkdirSync } from 'fs';
import { Progress } from 'vscode';
// Using native fetch available in Node.js 16+
import { AbortController } from 'abort-controller';
// Add types for node-fetch if needed for TypeScript support
import type { Response as FetchResponse } from 'node-fetch';
import { Checksum } from '../../cli/checksum';
import { messages } from '../../cli/messages/messages';
import { IConfiguration } from '../configuration/configuration';
import { IStaticCliApi } from '../../cli/staticCliApi';
import { CliExecutable } from '../../cli/cliExecutable';
import { ILog } from '../logger/interfaces';
import { CancellationToken } from '../vscode/types';
import { IVSCodeWindow } from '../vscode/window';
import { CliSupportedPlatform } from '../../cli/supportedPlatforms';
import { ExtensionContext } from '../vscode/extensionContext';
import { ERRORS } from '../constants/errors';

// Represents a response for downloading binary data with fetch
export type DownloadResponse = { data: stream.Readable; headers: Headers; };

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
      if (platform === null) {
        return Promise.reject(!messages.notSupported);
      }
      return await this.getCliExecutable(platform);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error(e);
      throw new Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  private async getCliExecutable(platform: CliSupportedPlatform): Promise<CliExecutable | null> {
    const cliPath = await this.configuration.getCliPath();
    const cliDir = path.dirname(cliPath);
    mkdirSync(cliDir, { recursive: true });
    if (await this.binaryExists(cliPath)) {
      await this.deleteFileAtPath(cliPath);
    }
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const cliVersion = await this.cliApi.getLatestCliVersion(cliReleaseChannel);
    const sha256 = await this.cliApi.getSha256Checksum(cliVersion, platform);
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

  public async downloadCli(
    cliPath: string,
    platform: CliSupportedPlatform,
    expectedChecksum: string,
  ): Promise<Checksum | null> {
    const hash = new Checksum(expectedChecksum);

    return this.window.withProgress(messages.progressTitle, async (progress, token) => {
      const [request, abortController]: [response: Promise<DownloadResponse>, controller: AbortController] =
        await this.cliApi.downloadBinary(platform);

      token.onCancellationRequested(async () => {
        abortController.abort();
        this.logger.info(messages.downloadCanceled);
        await this.deleteFileAtPath(cliPath);
      });

      progress.report({ increment: 0 });
      return await this.doDownload(abortController, token, cliPath, request, hash, progress);
    });
  }

  private async doDownload(
    abortController: AbortController,
    token: CancellationToken,
    path: string,
    request: Promise<DownloadResponse>,
    hash: Checksum,
    progress: Progress<{ message?: string; increment?: number }>,
  ): Promise<Checksum | null> {
    token.onCancellationRequested(async () => {
      abortController.abort();
      this.logger.info(messages.downloadCanceled);
      await this.deleteFileAtPath(path);
    });

    progress.report({ increment: 0 });
    const writer = fs.createWriteStream(path, {
      mode: 0o766,
    });

    let lastPercentCompleted = 0;

    try {
      const { data, headers } = await request;

      // Get content length from headers - needed for progress reporting
      const contentLength = parseInt(headers.get('content-length') || '0', 10);
      let downloadedBytes = 0;

      data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const percentCompleted = contentLength > 0 ? Math.floor((downloadedBytes / contentLength) * 100) : 0;
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
      // Check if the request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      throw err;
    }
  }
}
