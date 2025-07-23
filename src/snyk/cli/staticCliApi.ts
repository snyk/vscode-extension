import { IConfiguration } from '../common/configuration/configuration';
import { PROTOCOL_VERSION } from '../common/constants/languageServer';
import { ILog } from '../common/logger/interfaces';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CliExecutable } from './cliExecutable';
import { CliSupportedPlatform } from './supportedPlatforms';
import { ERRORS } from '../common/constants/errors';
import { VSCodeHttpClient, CancelToken, DownloadResponse } from '../common/vscodeHttpClient';

export interface IStaticCliApi {
  getLatestCliVersion(releaseChannel: string): Promise<string>;
  downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, CancelToken]>;
  getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string>;
}

export class StaticCliApi implements IStaticCliApi {
  private readonly httpClient: VSCodeHttpClient;

  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {
    this.httpClient = new VSCodeHttpClient(workspace, configuration, logger);
  }

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
      const data = await this.httpClient.request({
        url: this.getLatestVersionDownloadUrl(releaseChannel),
      });
      return data.replace('\n', '');
    } catch (e) {
      this.logger.error(e);
      throw Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  async downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadResponse>, CancelToken]> {
    const cancelToken = this.httpClient.createCancelToken();
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const latestCliVersion = await this.getLatestCliVersion(cliReleaseChannel);

    const downloadUrl = this.getDownloadUrl(latestCliVersion, platform);

    const response = this.httpClient.downloadStream(
      {
        url: downloadUrl,
      },
      cancelToken,
    );

    return [response, cancelToken];
  }

  async getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string> {
    const fileName = this.getFileName(platform);
    const data = await this.httpClient.request({
      url: this.getSha256DownloadUrl(version, platform),
    });

    const checksum = data.replace(fileName, '').replace('\n', '').trim();

    if (!checksum) return Promise.reject(new Error('Checksum not found'));

    return checksum;
  }
}
