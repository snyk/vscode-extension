import axios, { CancelTokenSource } from 'axios';
import stream from 'stream';
import { CliExecutable } from '../cliExecutable';
import { SupportedPlatformsType } from '../downloader';

export type CliDownloadAxiosResponse = { data: stream.Readable; headers: { [header: string]: unknown } };

export interface IStaticCliApi {
  getDownloadUrl(platform: SupportedPlatformsType): string;
  getExecutable(platform: SupportedPlatformsType): [Promise<CliDownloadAxiosResponse>, CancelTokenSource];
  getLatestVersion(): Promise<string>;
  getSha256Checksum(platform: SupportedPlatformsType): Promise<string>;
}

export class StaticCliApi implements IStaticCliApi {
  private readonly baseUrl = 'https://static.snyk.io';

  getDownloadUrl(platform: SupportedPlatformsType): string {
    return `${this.baseUrl}/cli/latest/${CliExecutable.getFilename(platform)}`;
  }

  getExecutable(platform: SupportedPlatformsType): [Promise<CliDownloadAxiosResponse>, CancelTokenSource] {
    const axiosCancelToken = axios.CancelToken.source();
    const downloadUrl = this.getDownloadUrl(platform);

    const response = axios.get(downloadUrl, {
      responseType: 'stream',
      cancelToken: axiosCancelToken.token,
    });

    return [response as Promise<CliDownloadAxiosResponse>, axiosCancelToken];
  }

  async getLatestVersion(): Promise<string> {
    let { data } = await axios.get<string>(`${this.baseUrl}/cli/latest/version`);

    // sanitise response
    data = data.replace('\n', '');
    return data;
  }

  async getSha256Checksum(platform: SupportedPlatformsType): Promise<string> {
    // https://static.snyk.io/cli/latest/snyk-macos.sha256
    let { data } = await axios.get<string>(`${this.baseUrl}/cli/latest/${CliExecutable.getFilename(platform)}.sha256`);

    // extract sha256 hex, equal to 256 bits = 64 chars
    data = data.substr(0, 64);
    return data;
  }
}
