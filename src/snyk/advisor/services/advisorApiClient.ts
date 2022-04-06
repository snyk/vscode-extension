import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DEFAULT_API_HEADERS } from '../../common/api/headers';
import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../../common/logger/interfaces';
import { AdvisorRegistry } from '../advisorTypes';

export interface IAdvisorApiClient {
  post<T = unknown, R = AxiosResponse<T>>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<R>;
  apiPath: string;
  getAdvisorUrl(registry: AdvisorRegistry): string;
}

export class AdvisorApiClient implements IAdvisorApiClient {
  private instance: AxiosInstance | null = null;
  private readonly advisorBaseUrl = 'https://snyk.io/advisor';
  apiPath = `/unstable/advisor/scores/npm-package`;

  constructor(private readonly configuration: IConfiguration, private readonly logger: ILog) {}

  getAdvisorUrl(registry: AdvisorRegistry): string {
    return `${this.advisorBaseUrl}/${registry}`;
  }

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp(): AxiosInstance {
    const http = axios.create({
      headers: DEFAULT_API_HEADERS,
      responseType: 'json',
    });

    http.interceptors.response.use(
      response => response,
      (error: Error) => {
        this.logger.error(`Call to Advisor API failed: ${error.message}`);
        return Promise.reject(error);
      },
    );

    this.instance = http;
    return http;
  }

  async post<T = unknown, R = AxiosResponse<T>>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<R> {
    const token = await this.configuration.getToken();
    this.http.interceptors.request.use(req => {
      req.baseURL = this.configuration.baseApiUrl;
      req.headers = {
        ...req.headers,
        Authorization: `token ${token}`,
      } as { [header: string]: string };

      return req;
    });
    return this.http.post<T, R>(url, data, config);
  }
}
