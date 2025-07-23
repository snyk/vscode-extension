import { IConfiguration } from '../common/configuration/configuration';
import { PROTOCOL_VERSION } from '../common/constants/languageServer';
import { ILog } from '../common/logger/interfaces';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CliExecutable } from './cliExecutable';
import { CliSupportedPlatform } from './supportedPlatforms';
import { xhr, configure } from 'request-light';
import { Readable } from 'stream';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as https from 'https';
import * as url from 'url';
import { ERRORS } from '../common/constants/errors';

export interface IStaticCliApi {
  getLatestCliVersion(releaseChannel: string): Promise<string>;
  downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, CancelToken]>;
  getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string>;
}

export interface DownloadResponse {
  data: Readable;
  headers: { [header: string]: unknown };
}

export interface CancelToken {
  cancel: () => void;
  token: {
    isCancellationRequested: boolean;
    onCancellationRequested: (fn: () => void) => void;
  };
}

export class StaticCliApi implements IStaticCliApi {
  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {
    // Configure request-light with VSCode proxy settings
    this.configureProxy();
  }

  private configureProxy(): void {
    const httpProxy = this.workspace.getConfiguration<string>('http', 'proxy');
    const proxyStrictSSL = this.workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;

    configure(httpProxy || undefined, proxyStrictSSL);
  }

  private getLatestVersionDownloadUrl(releaseChannel: string): string {
    return `${this.configuration.getCliBaseDownloadUrl()}/cli/${releaseChannel}/ls-protocol-version-${PROTOCOL_VERSION}`;
  }

  private getDownloadUrl(version: string, platform: CliSupportedPlatform): string {
    if (!version.startsWith('v')) {
      version = `v${version}`;
    }
    return `${this.configuration.getCliBaseDownloadUrl()}/cli/${version}/${CliExecutable.getFileName(platform)}`;
  }

  private getSha256DownloadUrl(version: string, platform: CliSupportedPlatform): string {
    return `${this.getDownloadUrl(version, platform)}.sha256`;
  }

  async getLatestCliVersion(releaseChannel: string): Promise<string> {
    try {
      const response = await xhr({
        url: this.getLatestVersionDownloadUrl(releaseChannel),
      });

      if (response.status >= 200 && response.status < 300) {
        // The response is plain text with the version string
        return response.responseText.replace('\n', '').trim();
      } else {
        throw new Error(`Failed to fetch CLI version: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(error);
      throw Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  async downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, CancelToken]> {
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const latestCliVersion = await this.getLatestCliVersion(cliReleaseChannel);
    const downloadUrl = this.getDownloadUrl(latestCliVersion, platform);

    // Create a cancel token compatible with our interface
    let isCancelled = false;
    const cancellationHandlers: (() => void)[] = [];

    const cancelToken: CancelToken = {
      cancel: () => {
        isCancelled = true;
        cancellationHandlers.forEach(handler => handler());
      },
      token: {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: (fn: () => void) => {
          cancellationHandlers.push(fn);
        },
      },
    };

    const downloadPromise = this.performDownload(downloadUrl, cancelToken);

    return [downloadPromise, cancelToken];
  }

  private async performDownload(downloadUrl: string, cancelToken: CancelToken): Promise<DownloadResponse> {
    // For streaming downloads, we need to use Node.js https directly since request-light doesn't support streaming
    // However, we can still use request-light to respect proxy settings by getting the configured proxy
    const parsedUrl = url.parse(downloadUrl);

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: 'GET',
      };

      // Get proxy configuration from VSCode settings
      const httpProxy = this.workspace.getConfiguration<string>('http', 'proxy');
      if (httpProxy) {
        options.agent = new HttpsProxyAgent(httpProxy);
      }

      const req = https.request(options, res => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            data: res as unknown as Readable,
            headers: res.headers,
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });

      req.on('error', reject);

      if (cancelToken) {
        cancelToken.token.onCancellationRequested(() => {
          req.destroy(new Error('Request cancelled'));
        });
      }

      req.end();
    });
  }

  async getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string> {
    const fileName = CliExecutable.getFileName(platform);

    try {
      const response = await xhr({
        url: this.getSha256DownloadUrl(version, platform),
      });

      if (response.status >= 200 && response.status < 300) {
        const checksum = response.responseText.replace(fileName, '').replace('\n', '').trim();

        if (!checksum) {
          return Promise.reject(new Error('Checksum not found'));
        }

        return checksum;
      } else {
        throw new Error(`Failed to fetch checksum: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch checksum: ${error}`);
      throw error;
    }
  }
}
