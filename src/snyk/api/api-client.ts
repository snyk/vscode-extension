import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { User } from "./user";

export class ApiClient {
  readonly client: AxiosInstance;
  private readonly token: string;

  constructor(baseURL: string, token: string) {
    const options: AxiosRequestConfig = {
      baseURL: baseURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      },
      responseType: 'json',
    };

    this.client = axios.create(options);
    this.token = token;

    this.initializeRequestInterceptor();
  }

  private initializeRequestInterceptor = () => {
    this.client.interceptors.request.use(this.handleRequest);
  };

  private handleRequest = (config: AxiosRequestConfig) => {
    config.headers['Authorization'] = `token ${this.token}`;
    return config;
  };

  userMe = async(): Promise<User> => {
    const response = await this.client.get<User>('/user/me');
    return response.data;
  }
}
