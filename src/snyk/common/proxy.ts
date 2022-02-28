import { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as url from 'url';
import { IVSCodeWorkspace } from './vscode/workspace';

export function getHttpsProxyAgent(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgent | undefined {
  let proxy: string | undefined = getVsCodeProxy(workspace);
  if (!proxy) {
    proxy = processEnv.HTTPS_PROXY || processEnv.https_proxy || processEnv.HTTP_PROXY || processEnv.http_proxy;
    if (!proxy) {
      return undefined; // No proxy
    }
  }

  // Basic sanity checking on proxy url
  const proxyUrl = url.parse(proxy);
  if (proxyUrl.protocol !== 'https:' && proxyUrl.protocol !== 'http:') {
    return undefined;
  }

  const strictProxy = workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
  const proxyOptions = {
    host: proxyUrl.hostname,
    port: proxyUrl.port ? parseInt(proxyUrl.port, 10) : null,
    auth: proxyUrl.auth,
    rejectUnauthorized: strictProxy,
  };

  return new HttpsProxyAgent(proxyOptions);
}

export function getVsCodeProxy(workspace: IVSCodeWorkspace): string | undefined {
  return workspace.getConfiguration<string>('http', 'proxy');
}

export function getAxiosProxyConfig(workspace: IVSCodeWorkspace): AxiosRequestConfig {
  return {
    proxy: false,
    httpAgent: getHttpsProxyAgent(workspace),
    httpsAgent: getHttpsProxyAgent(workspace),
  };
}
