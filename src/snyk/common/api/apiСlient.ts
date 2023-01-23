import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IConfiguration } from '../configuration/configuration';
import { configuration } from '../configuration/instance';
import { ILog } from '../logger/interfaces';
import { getAxiosConfig } from '../proxy';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { DEFAULT_API_HEADERS } from './headers';

export interface ISnykApiClient {
  get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
}

export class SnykApiClient implements ISnykApiClient {
  private instance: Promise<AxiosInstance> | null = null;

  constructor(
    private readonly configuration: IConfiguration,
    private readonly workspace: IVSCodeWorkspace,
    private readonly logger: ILog,
  ) {}

  private get http(): Promise<AxiosInstance> {
    return this.instance != null ? this.instance : this.initHttp();
  }

  async initHttp(): Promise<AxiosInstance> {
    const axiosRequestConfig: AxiosRequestConfig = {
      headers: DEFAULT_API_HEADERS,
      responseType: 'json',
      ...(await getAxiosConfig(this.workspace, this.configuration, this.logger)),
    };

    const http = axios.create(axiosRequestConfig);

    http.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await configuration.clearToken();
          this.logger.warn('Call to Snyk API failed - Invalid token');
          return;
        }
        this.logger.error(`Call to Snyk API failed: ${error}`);
        return Promise.reject(error);
      },
    );

    this.instance = Promise.resolve(http);
    return http;
  }

  async get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return (await this.http).get<T, R>(url, await this.getRequestConfigWithAuth(config));
  }

  async post<T = unknown, R = AxiosResponse<T>>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<R> {
    return (await this.http).post<T, R>(url, data, await this.getRequestConfigWithAuth(config));
  }

  private async getRequestConfigWithAuth(config?: AxiosRequestConfig) {
    const token = await this.configuration.getToken();
    return {
      ...config,
      baseURL: `${this.configuration.authHost}/api/`,
      headers: {
        ...config?.headers,
        Authorization: `token ${token}`,
      } as { [header: string]: string },
    };
  }
}
