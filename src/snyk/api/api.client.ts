import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const headers: Readonly<Record<string, string | boolean>> = {
  Accept: 'application/json',
  'Content-Type': 'application/json; charset=utf-8',
};

class ApiClient {
  private instance: AxiosInstance | null = null;
  // TODO: get token and baseURL from settings?

  private get http(): AxiosInstance {
    return this.instance != null ? this.instance : this.initHttp();
  }

  initHttp() {
    const http = axios.create({
      baseURL: 'https://snyk.io/api/v1/',
      headers,
      responseType: 'json',
    });

    http.interceptors.response.use(
      response => response,
      error => {
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

export const api = new ApiClient();
