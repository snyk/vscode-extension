import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IConfiguration } from '../configuration/configuration';
import { configuration } from '../configuration/instance';
import { ILog } from '../logger/interfaces';
import { getAxiosProxyConfig } from '../proxy';
import { IVSCodeWorkspace } from '../vscode/workspace';
import { DEFAULT_API_HEADERS } from './headers';

export interface ISnykApiClient {
  get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
}

export class SnykApiClient implements ISnykApiClient {
  private instance: AxiosInstance | null = null;

  constructor(
    private readonly configuration: IConfiguration,
    private readonly workspace: IVSCodeWorkspace,
    private readonly logger: ILog,
  ) {}

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp(): AxiosInstance {
    const http = axios.create({
      headers: DEFAULT_API_HEADERS,
      responseType: 'json',
      ...getAxiosProxyConfig(this.workspace),
    });

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

    this.instance = http;
    return http;
  }

  async get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return this.http.get<T, R>(url, await this.getRequestConfigWithAuth(config));
  }

  async post<T = unknown, R = AxiosResponse<T>>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<R> {
    return this.http.post<T, R>(url, data, await this.getRequestConfigWithAuth(config));
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
