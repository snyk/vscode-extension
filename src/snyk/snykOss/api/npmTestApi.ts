import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DEFAULT_API_HEADERS } from '../../common/api/headers';
import { configuration } from '../../common/configuration/instance';
import { ILog } from '../../common/logger/interfaces';
import { PackageIssues } from '../../common/packageIssues';
import { getAxiosProxyConfig } from '../../common/proxy';
import { User } from '../../common/user';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

export class NpmTestApi {
  private instance: AxiosInstance | null = null;

  constructor(
    private readonly logger: ILog,
    private readonly workspace: IVSCodeWorkspace,
    private readonly user: User,
  ) {}

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp(): AxiosInstance {
    const apiToken = this.user.authenticatedId;
    const headers = {
      ...DEFAULT_API_HEADERS,
      Authorization: `token ${apiToken}`,
    };
    const http = axios.create({
      headers: headers,
      responseType: 'json',
      baseURL: configuration.baseApiUrl + '/rest',
      ...getAxiosProxyConfig(this.workspace),
    });

    http.interceptors.response.use(
      response => response,
      error => {
        this.logger.error(`Call to Snyk NPM Test API failed. ${error}`);
        return Promise.reject(error);
      },
    );

    this.instance = http;
    return http;
  }

  get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return this.http.get<T, R>(url, config);
  }

  async getPackageVulnerabilityCount(packageName: string, packageVersion: string): Promise<number> {
    const url = `/orgs/${this.user.orgId}/packages/pkg%3npm%2F${packageName}%40${packageVersion}/issues?version=2022-11-14`;
    const response = await this.http.get<PackageIssues, AxiosResponse<PackageIssues>>(url);

    return response.data.data.length;
  }
}
