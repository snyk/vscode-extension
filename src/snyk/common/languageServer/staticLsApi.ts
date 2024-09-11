import axios, { CancelTokenSource } from 'axios';
import { IConfiguration } from '../configuration/configuration';
import { PROTOCOL_VERSION } from '../constants/languageServer';
import { DownloadAxiosResponse } from '../download/downloader';
import { ILog } from '../logger/interfaces';
import { getAxiosConfig } from '../proxy';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { LsExecutable } from './lsExecutable';
import { LsSupportedPlatform } from './supportedPlatforms';

export type LsMetadata = {
  tag: string;
  version: string;
  commit: string;
  date: string;
  previous_tag: string;
  project_name: string;
  runtime: string;
};

export interface IStaticLsApi {
  getDownloadUrl(platform: LsSupportedPlatform): Promise<string>;

  downloadBinary(platform: LsSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]>;

  getMetadata(): Promise<LsMetadata>;

  getSha256Checksum(platform: LsSupportedPlatform): Promise<string>;
}

export class StaticLsApi implements IStaticLsApi {
  private readonly baseUrl = `https://static.snyk.io/snyk-ls/${PROTOCOL_VERSION}`;

  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {}

  async getDownloadUrl(platform: LsSupportedPlatform): Promise<string> {
    return `${this.baseUrl}/${await this.getFileName(platform)}`;
  }

  async getFileName(platform: LsSupportedPlatform): Promise<string> {
    return LsExecutable.getVersionedFilename(platform, await this.getLatestVersion());
  }

  async downloadBinary(platform: LsSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]> {
    const axiosCancelToken = axios.CancelToken.source();
    const downloadUrl = await this.getDownloadUrl(platform);

    const response = axios.get(downloadUrl, {
      responseType: 'stream',
      cancelToken: axiosCancelToken.token,
      ...(await getAxiosConfig(this.workspace, this.configuration, this.logger)),
    });

    return [response as Promise<DownloadAxiosResponse>, axiosCancelToken];
  }

  async getLatestVersion(): Promise<string> {
    return Promise.resolve(this.getMetadata().then(metadata => metadata.version));
  }

  async getSha256Checksum(platform: LsSupportedPlatform): Promise<string> {
    const fileName = await this.getFileName(platform);
    const { data } = await axios.get<string>(
      `${this.baseUrl}/snyk-ls_${await this.getLatestVersion()}_SHA256SUMS`,
      await getAxiosConfig(this.workspace, this.configuration, this.logger),
    );

    let checksum = '';
    data.split('\n').forEach(line => {
      if (line.includes(fileName)) {
        checksum = line.split(' ')[0].trim().toLowerCase();
      }
    });
    if (checksum == '') return Promise.reject(new Error('Checksum not found'));

    return checksum;
  }

  async getMetadata(): Promise<LsMetadata> {
    const response = await axios.get<LsMetadata>(
      `${this.baseUrl}/metadata.json`,
      await getAxiosConfig(this.workspace, this.configuration, this.logger),
    );
    return response.data;
  }
}
