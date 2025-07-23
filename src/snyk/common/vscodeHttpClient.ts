import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as stream from 'stream';
import { IConfiguration } from './configuration/configuration';
import { ILog } from './logger/interfaces';
import { IVSCodeWorkspace } from './vscode/workspace';
import { getHttpsProxyAgent } from './proxy';

export interface RequestOptions {
  url: string;
  method?: string;
  headers?: { [key: string]: string };
  responseType?: 'stream' | 'text';
}

export interface DownloadResponse {
  data: stream.Readable;
  headers: { [header: string]: unknown };
}

export interface CancelToken {
  cancel: () => void;
  token: {
    isCancellationRequested: boolean;
    onCancellationRequested: (fn: () => void) => void;
  };
}

export class VSCodeHttpClient {
  private activeRequests = new Set<http.ClientRequest>();

  constructor(
    private readonly workspace: IVSCodeWorkspace,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {}

  createCancelToken(): CancelToken {
    let isCancelled = false;
    const cancellationHandlers: (() => void)[] = [];

    return {
      cancel: () => {
        isCancelled = true;
        cancellationHandlers.forEach(handler => handler());
      },
      token: {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: (fn: () => void) => {
          cancellationHandlers.push(fn);
        },
      },
    };
  }

  async request(options: RequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      this.makeRequest(
        options,
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });
        },
        reject,
      ).catch(reject);
    });
  }

  async downloadStream(options: RequestOptions, cancelToken?: CancelToken): Promise<DownloadResponse> {
    const parsedUrl = url.parse(options.url);
    const isHttps = parsedUrl.protocol === 'https:';

    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    // Add proxy agent if configured
    const proxyAgent = await getHttpsProxyAgent(this.workspace, this.configuration, this.logger);

    if (proxyAgent) {
      requestOptions.agent = proxyAgent;
    }

    return new Promise((resolve, reject) => {
      const httpModule = isHttps ? https : http;
      const req = httpModule.request(requestOptions, res => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            data: res as stream.Readable,
            headers: res.headers,
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });

      this.activeRequests.add(req);

      req.on('error', reject);
      req.on('close', () => {
        this.activeRequests.delete(req);
      });

      if (cancelToken) {
        cancelToken.token.onCancellationRequested(() => {
          req.destroy(new Error('Request cancelled'));
          this.activeRequests.delete(req);
        });
      }

      req.end();
    });
  }

  private async makeRequest(
    options: RequestOptions,
    onResponse: (res: http.IncomingMessage) => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    const parsedUrl = url.parse(options.url);
    const isHttps = parsedUrl.protocol === 'https:';

    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    // Add proxy agent if configured
    const proxyAgent = await getHttpsProxyAgent(this.workspace, this.configuration, this.logger);

    if (proxyAgent) {
      requestOptions.agent = proxyAgent;
    }

    const httpModule = isHttps ? https : http;
    const req = httpModule.request(requestOptions, onResponse);

    this.activeRequests.add(req);

    req.on('error', onError);
    req.on('close', () => {
      this.activeRequests.delete(req);
    });

    req.end();
  }
}
