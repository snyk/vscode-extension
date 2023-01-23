import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DEFAULT_API_HEADERS } from '../../common/api/headers';
import { configuration } from '../../common/configuration/instance';
import { ILog } from '../../common/logger/interfaces';
import { getAxiosConfig } from '../../common/proxy';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

export class NpmTestApi {
  private instance: Promise<AxiosInstance> | null = null;

  constructor(private readonly logger: ILog, private readonly workspace: IVSCodeWorkspace) {}

  private get http(): Promise<AxiosInstance> {
    return this.instance != null ? this.instance : this.initHttp();
  }

  async initHttp(): Promise<AxiosInstance> {
    const http = axios.create({
      headers: DEFAULT_API_HEADERS,
      responseType: 'json',
      baseURL: configuration.authHost + '/test',
      ...(await getAxiosConfig(this.workspace, configuration, this.logger)),
    });

    http.interceptors.response.use(
      response => response,
      error => {
        this.logger.error(`Call to Snyk NPM Test API failed. ${error}`);
        return Promise.reject(error);
      },
    );

    this.instance = Promise.resolve(http);
    return http;
  }

  async get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return (await this.http).get<T, R>(url, config);
  }
}
