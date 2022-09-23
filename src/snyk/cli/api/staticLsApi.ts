import axios, { CancelTokenSource } from 'axios';
import stream from 'stream';
import { PROTOCOL_VERSION } from '../../common/constants/languageServer';
import { LsExecutable } from '../../common/languageServer/lsExecutable';
import { getAxiosProxyConfig } from '../../common/proxy';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { LsSupportedPlatform } from '../supportedPlatforms';
import { DownloadAxiosResponse } from '../downloader';

export type LsMetadata = {
  tag: string;
  version: string;
  commit: string;
  date: string;
  previous_tag: string;
  project_name: string;
  runtime: any;
};

export interface IStaticLsApi {
  getDownloadUrl(platform: LsSupportedPlatform): Promise<string>;

  downloadBinary(platform: LsSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]>;

  getMetadata(): Promise<LsMetadata>;

  getSha256Checksum(platform: LsSupportedPlatform): Promise<string>;
}

export class StaticLsApi implements IStaticLsApi {
  private readonly baseUrl = `https://static.snyk.io/snyk-ls/${PROTOCOL_VERSION}`;
  private metadata: LsMetadata;

  constructor(private readonly workspace: IVSCodeWorkspace) {}

  async getDownloadUrl(platform: LsSupportedPlatform): Promise<string> {
    return `${this.baseUrl}/${await this.getFileName(platform)}`;
  }

  async getFileName(platform: LsSupportedPlatform): Promise<string> {
    const version = await this.getLatestVersion();
    return `snyk-ls_${version}_${LsExecutable.getFilenameSuffix(platform)}`;
  }

  async downloadBinary(platform: LsSupportedPlatform): Promise<[Promise<DownloadAxiosResponse>, CancelTokenSource]> {
    const axiosCancelToken = axios.CancelToken.source();
    const downloadUrl = await this.getDownloadUrl(platform);

    const response = axios.get(downloadUrl, {
      responseType: 'stream',
      cancelToken: axiosCancelToken.token,
      ...getAxiosProxyConfig(this.workspace),
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
      getAxiosProxyConfig(this.workspace),
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
    const response = await axios.get<string>(`${this.baseUrl}/metadata.json`, getAxiosProxyConfig(this.workspace));
    return response.data as unknown as LsMetadata;
  }
}
