import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { configuration } from '../configuration';

const defaultHeaders: Readonly<Record<string, string | boolean>> = {
  Accept: 'application/json',
  'Content-Type': 'application/json; charset=utf-8',
};

class ApiClient {
  private instance: AxiosInstance | null = null;

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp() {
    const http = axios.create({
      headers: defaultHeaders,
      responseType: 'json',
    });

    http.interceptors.response.use(
      response => response,
      error => {
        console.error('Call to Snyk API failed: ', error);
        return Promise.reject(error);
      },
    );

    this.instance = http;
    return http;
  }

  get<T = unknown, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    this.http.interceptors.request.use(req => {
      req.baseURL = `${configuration.authHost}/api/v1/`;
      req.headers = {
        ...req.headers,
        Authorization: `token ${configuration.token}`,
      };

      return req;
    });

    return this.http.get<T, R>(url, config);
  }
}

export const api = new ApiClient();
