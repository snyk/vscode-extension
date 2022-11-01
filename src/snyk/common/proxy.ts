import { AxiosRequestConfig } from 'axios';
import createHttpsProxyAgent, { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import * as url from 'url';
import { IVSCodeWorkspace } from './vscode/workspace';

export function getHttpsProxyAgent(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgent {
  return new HttpsProxyAgent(getProxyOptions(workspace, processEnv));
}

export function getProxyOptions(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgentOptions {
  let proxy: string | undefined = getVsCodeProxy(workspace);

  const strictProxy = workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
  const defaultOptions: HttpsProxyAgentOptions = {
    rejectUnauthorized: strictProxy,
  };

  if (!proxy) {
    proxy = processEnv.HTTPS_PROXY || processEnv.https_proxy || processEnv.HTTP_PROXY || processEnv.http_proxy;
    if (!proxy) {
      return defaultOptions; // No proxy
    }
  }

  // Basic sanity checking on proxy url
  const proxyUrl = url.parse(proxy);
  if (proxyUrl.protocol !== 'https:' && proxyUrl.protocol !== 'http:') {
    return defaultOptions;
  }

  if (proxyUrl.hostname == null || proxyUrl.hostname === '') {
    return defaultOptions;
  }

  let port;
  if (proxyUrl.port && proxyUrl.port !== '') {
    port = parseInt(proxyUrl.port, 10);
  }
  return {
    host: proxyUrl.hostname,
    port: port,
    auth: proxyUrl.auth,
    rejectUnauthorized: strictProxy,
    protocol: proxyUrl.protocol,
  };
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

export function getProxyEnvVariable(
  proxyOptions: createHttpsProxyAgent.HttpsProxyAgentOptions | undefined,
): string | undefined {
  if (!proxyOptions) {
    return;
  }
  const { host, port, auth, protocol } = proxyOptions;
  if (!host) return;

  // noinspection HttpUrlsUsage
  return `${protocol}//${auth ? `${auth}@` : ''}${host}${port ? `:${port}` : ''}`;
}
