import * as https from 'https';
import * as http from 'http';
import * as stream from 'stream';
import { IConfiguration } from './configuration/configuration';
import { ILog } from './logger/interfaces';
import { IVSCodeWorkspace } from './vscode/workspace';
import { getHttpsProxyAgent } from './proxy';

export class RequestCancelledError extends Error {
  constructor() {
    super('Request cancelled');
    this.name = 'RequestCancelledError';
    Object.setPrototypeOf(this, RequestCancelledError.prototype);
  }
}

export interface RequestOptions {
  url: string;
  method?: string;
  headers?: { [key: string]: string };
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
    const { requestOptions, httpModule } = await this.prepareRequest(options);

    return new Promise((resolve, reject) => {
      const request = httpModule.request(requestOptions, res => {
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
      });

      this.setupRequestHandlers(request, reject);
      request.end();
    });
  }

  async downloadStream(options: RequestOptions, cancelToken?: CancelToken): Promise<DownloadResponse> {
    const { requestOptions, httpModule } = await this.prepareRequest(options);

    return new Promise((resolve, reject) => {
      const request = httpModule.request(requestOptions, res => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            data: res as stream.Readable,
            headers: res.headers,
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });

      this.setupRequestHandlers(request, reject, cancelToken);
      request.end();
    });
  }

  private async prepareRequest(options: RequestOptions): Promise<{
    requestOptions: https.RequestOptions;
    httpModule: typeof https | typeof http;
  }> {
    const parsedUrl = new URL(options.url);
    const isHttps = parsedUrl.protocol === 'https:';

    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    // Add proxy agent if configured
    const proxyAgent = await getHttpsProxyAgent(this.workspace, this.configuration, this.logger);
    if (proxyAgent) {
      requestOptions.agent = proxyAgent;
    }

    const httpModule = isHttps ? https : http;

    return { requestOptions, httpModule };
  }

  private setupRequestHandlers(
    request: http.ClientRequest,
    onError: (err: Error) => void,
    cancelToken?: CancelToken,
  ): void {
    this.activeRequests.add(request);

    request.on('error', onError);
    request.on('close', () => {
      this.activeRequests.delete(request);
    });

    if (cancelToken) {
      cancelToken.token.onCancellationRequested(() => {
        request.destroy(new RequestCancelledError());
        this.activeRequests.delete(request);
      });
    }
  }
}
