import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DEFAULT_API_HEADERS } from '../../common/api/headers';
import { ILog } from '../../common/logger/interfaces';
import { Logger } from '../../common/logger/logger';

class NpmRegistryApiClient {
  private instance: AxiosInstance | null = null;
  private readonly npmRegistryHost = 'https://registry.npmjs.org/';

  constructor(private readonly logger: ILog) {}

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp() {
    const http = axios.create({
      headers: DEFAULT_API_HEADERS,
      responseType: 'json',
      baseURL: this.npmRegistryHost,
    });

    http.interceptors.response.use(
      response => response,
      error => {
        this.logger.error(`Call to NPM Registry API failed. ${error}`);
        return Promise.reject(error);
      },
    );

    this.instance = http;
    return http;
  }

  get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return this.http.get<T, R>(url, config);
  }
}

export const npmRegistryApi = new NpmRegistryApiClient(Logger);
