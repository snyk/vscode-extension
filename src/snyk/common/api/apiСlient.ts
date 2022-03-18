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
    await this.setupRequestAuth();
    return this.http.get<T, R>(url, config);
  }

  async post<T = unknown, R = AxiosResponse<T>>(url: string, data: unknown, config?: AxiosRequestConfig): Promise<R> {
    await this.setupRequestAuth();
    return this.http.post<T, R>(url, data, config);
  }

  private async setupRequestAuth() {
    const token = await this.configuration.getToken();
    this.http.interceptors.request.use(req => {
      req.baseURL = `${this.configuration.authHost}/api/v1/`;
      req.headers = {
        ...req.headers,
        Authorization: `token ${token}`,
      } as { [header: string]: string };

      return req;
    });
  }
}
