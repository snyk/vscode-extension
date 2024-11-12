import axios, { CancelTokenSource } from 'axios';
import { IConfiguration } from '../common/configuration/configuration';
import { PROTOCOL_VERSION } from '../common/constants/languageServer';
import { DownloadAxiosResponse } from '../common/download/downloader';
import { ILog } from '../common/logger/interfaces';
import { getAxiosConfig } from '../common/proxy';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CliExecutable } from './cliExecutable';
import { CliSupportedPlatform } from './supportedPlatforms';
import { ERRORS } from '../common/constants/errors';

export interface IStaticCliApi {
  getLatestCliVersion(releaseChannel: string): Promise<string>;
  downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]>;
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
      let { data } = await axios.get<string>(
        this.getLatestVersionDownloadUrl(releaseChannel),
        await getAxiosConfig(this.workspace, this.configuration, this.logger),
      );
      data = data.replace('\n', '');
      return data;
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error(e);
      throw Error(ERRORS.DOWNLOAD_FAILED);
    }
  }

  async downloadBinary(platform: CliSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]> {
    const axiosCancelToken = axios.CancelToken.source();
    const cliReleaseChannel = await this.configuration.getCliReleaseChannel();
    const latestCliVersion = await this.getLatestCliVersion(cliReleaseChannel);

    const downloadUrl = this.getDownloadUrl(latestCliVersion, platform);

    const response = axios.get(downloadUrl, {
      responseType: 'stream',
      cancelToken: axiosCancelToken.token,
      ...(await getAxiosConfig(this.workspace, this.configuration, this.logger)),
    });

    return [response as Promise<DownloadAxiosResponse>, axiosCancelToken];
  }

  async getSha256Checksum(version: string, platform: CliSupportedPlatform): Promise<string> {
    const fileName = this.getFileName(platform);
    const { data } = await axios.get<string>(
      `${this.getSha256DownloadUrl(version, platform)}`,
      await getAxiosConfig(this.workspace, this.configuration, this.logger),
    );

    const checksum = data.replace(fileName, '').replace('\n', '').trim();

    if (!checksum) return Promise.reject(new Error('Checksum not found'));

    return checksum;
  }
}
