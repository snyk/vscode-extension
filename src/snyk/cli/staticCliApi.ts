import { AbortController } from 'abort-controller';
import { IConfiguration } from '../common/configuration/configuration';
import { PROTOCOL_VERSION } from '../common/constants/languageServer';
import { DownloadResponse } from '../common/download/downloader';
import { ILog } from '../common/logger/interfaces';
import { getFetchOptions } from '../common/proxy';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CliExecutable } from './cliExecutable';
import { CliSupportedPlatform } from './supportedPlatforms';
import { ERRORS } from '../common/constants/errors';

export interface IStaticCliApi {
  getLatestCliVersion(releaseChannel: string): Promise<string>;
  downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, AbortController]>;
  getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string>;
}

export class StaticCliApi implements IStaticCliApi {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {}

  getLatestVersionDownloadUrl(releaseChannel: string): string {
    const downloadUrl = `${this.configuration.getCliBaseDownloadUrl()}/cli/${releaseChannel}/ls-protocol-version-${PROTOCOL_VERSION}`;
    return downloadUrl;
  }

  getDownloadUrl(version: string, platform: CliSupportedPlatform): string {
    if (!version.startsWith('v')) {
      version = `v${version}`;
    }
    const downloadUrl = `${this.configuration.getCliBaseDownloadUrl()}/cli/${version}/${this.getFileName(platform)}`;
    return downloadUrl;
  }

  getSha256DownloadUrl(version: string, platform: CliSupportedPlatform): string {
    const downloadUrl = `${this.getDownloadUrl(version, platform)}.sha256`;
    return downloadUrl;
  }

  getFileName(platform: CliSupportedPlatform): string {
    return CliExecutable.getFileName(platform);
  }

  async getLatestCliVersion(releaseChannel: string): Promise<string> {
    try {
      const url = this.getLatestVersionDownloadUrl(releaseChannel);
      const fetchOptions = await getFetchOptions(this.workspace, this.configuration, this.logger);
      
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to fetch latest version: ${response.status} ${response.statusText}`);
      }
      
      let data = await response.text();
      data = data.replace('\n', '');
      return data;
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error(e);
      throw Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  async downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, AbortController]> {
    // Create abort controller for cancelable requests
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const latestCliVersion = await this.getLatestCliVersion(cliReleaseChannel);

    const downloadUrl = this.getDownloadUrl(latestCliVersion, platform);
    
    // Get fetch options with proxy and certificate handling
    const fetchOptions = await getFetchOptions(this.workspace, this.configuration, this.logger);
    
    // Create a promise that will resolve with the download response
    const responsePromise = fetch(downloadUrl, {
      // Cast signal to any to avoid TypeScript compatibility issues
      signal: signal as any,
      ...fetchOptions,
    }).then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      // Check if body exists
      const body = response.body;
      if (!body) {
        throw new Error('Response body is null');
      }
      
      // Convert the ReadableStream to a Node.js Readable stream
      const { Readable } = require('stream');
      const nodeReadable = Readable.fromWeb(body);
      
      return {
        data: nodeReadable,
        headers: response.headers
      };
    });
    
    return [responsePromise, abortController];
  }

  async getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string> {
    const fileName = this.getFileName(platform);
    const url = this.getSha256DownloadUrl(version, platform);
    const fetchOptions = await getFetchOptions(this.workspace, this.configuration, this.logger);
    
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`Failed to fetch checksum: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.text();

    const checksum = data.replace(fileName, '').replace('\n', '').trim();

    if (!checksum) return Promise.reject(new Error('Checksum not found'));

    return checksum;
  }
}
