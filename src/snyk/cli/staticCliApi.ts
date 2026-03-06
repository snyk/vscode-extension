import { IConfiguration } from '../common/configuration/configuration';
import { PROTOCOL_VERSION } from '../common/constants/languageServer';
import { HTTP_CONFIGURATION_IDENTIFIER, HTTP_PROXY, HTTP_PROXY_STRICT_SSL } from '../common/constants/settings';
import { ILog } from '../common/logger/interfaces';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CliExecutable } from './cliExecutable';
import { CliSupportedPlatform } from './supportedPlatforms';
import { xhr, configure } from 'request-light';
import { Readable } from 'stream';
import * as https from 'https';
import { ERRORS } from '../common/constants/errors';

export interface IStaticCliApi {
  getLatestCliVersion(releaseChannel: string, protocolVersion?: number): Promise<string>;
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
    const httpProxy = this.workspace.getConfiguration<string>(HTTP_CONFIGURATION_IDENTIFIER, HTTP_PROXY);
    const proxyStrictSSL =
      this.workspace.getConfiguration<boolean>(HTTP_CONFIGURATION_IDENTIFIER, HTTP_PROXY_STRICT_SSL) ?? true;

    configure(httpProxy || undefined, proxyStrictSSL);
  }

  private getLatestVersionDownloadUrl(releaseChannel: string, protocolVersion: number): string {
    return `${this.configuration.getCliBaseDownloadUrl()}/cli/${releaseChannel}/ls-protocol-version-${protocolVersion}`;
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

  async getLatestCliVersion(releaseChannel: string, protocolVersion: number = PROTOCOL_VERSION): Promise<string> {
    const url = this.getLatestVersionDownloadUrl(releaseChannel, protocolVersion);
    this.logger.info(`Fetching latest CLI version from "${url}".`);
    try {
      const response = await xhr({ url });

      if (response.status >= 200 && response.status < 400) {
        // The response is plain text with the version string
        const version = response.responseText.replace('\n', '').trim();
        this.logger.info(`Version endpoint responded with status ${response.status}: version "${version}".`);
        return version;
      } else {
        throw new Error(`Version endpoint returned unexpected HTTP status ${response.status}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch latest CLI version from "${url}": ${error instanceof Error ? error.message : error}`,
      );
      throw Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  async downloadBinary(
    platform: CliSupportedPlatform,
    protocolVersion: number = PROTOCOL_VERSION,
  ): Promise<[Promise<DownloadResponse>, CancelToken]> {
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const latestCliVersion = await this.getLatestCliVersion(cliReleaseChannel, protocolVersion);
    const downloadUrl = this.getDownloadUrl(latestCliVersion, platform);
    this.logger.info(
      `Downloading CLI binary: version ${latestCliVersion}, platform ${platform}, url "${downloadUrl}".`,
    );

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
    // Use request-light for proxy configuration, but we need streaming for large binary downloads
    // request-light automatically configures the global agent with proxy settings
    const parsedUrl = new URL(downloadUrl);

    return new Promise((resolve, reject) => {
      // Get SSL verification setting from VSCode configuration
      const proxyStrictSSL =
        this.workspace.getConfiguration<boolean>(HTTP_CONFIGURATION_IDENTIFIER, HTTP_PROXY_STRICT_SSL) ?? true;

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        rejectUnauthorized: proxyStrictSSL,
      };

      // request-light's configure() call should have set up the global agent with proxy settings
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
    const url = this.getSha256DownloadUrl(version, platform);
    this.logger.info(`Fetching SHA-256 checksum from "${url}".`);

    try {
      const response = await xhr({ url });

      if (response.status >= 200 && response.status < 300) {
        const checksum = response.responseText.replace(fileName, '').replace('\n', '').trim();
        this.logger.info(
          `Checksum endpoint responded with status ${response.status}: "${checksum}" for ${version} on ${platform}.`,
        );

        if (!checksum) {
          this.logger.error(
            'Checksum response was received but contained no valid checksum after parsing. The server response may be malformed.',
          );
          return Promise.reject(new Error('Checksum not found'));
        }

        return checksum;
      } else {
        throw new Error(`Checksum endpoint returned unexpected HTTP status ${response.status}.`);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch checksum from "${url}": ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
