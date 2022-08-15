import { AxiosRequestConfig } from 'axios';
import createHttpsProxyAgent, { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import * as url from 'url';
import { IVSCodeWorkspace } from './vscode/workspace';

export function getHttpsProxyAgent(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgent | undefined {
  const proxyOptions = getProxyOptions(workspace, processEnv);
  if (proxyOptions == undefined) {
    return undefined;
  }
  return new HttpsProxyAgent(proxyOptions);
}

export function getProxyOptions(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgentOptions | undefined {
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

  if (proxyUrl.hostname == null || proxyUrl.hostname === '' || proxyUrl.port == null || proxyUrl.port === '') {
    return undefined;
  }

  const strictProxy = workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;

  return {
    host: proxyUrl.hostname,
    port: parseInt(proxyUrl.port, 10),
    auth: proxyUrl.auth,
    rejectUnauthorized: strictProxy,
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

export function getProxyEnvVariable(proxyOptions: createHttpsProxyAgent.HttpsProxyAgentOptions | undefined): string {
  if (!proxyOptions) {
    return '';
  }
  const { host, port } = proxyOptions;
  // TODO: add auth to proxy env variable
  // noinspection HttpUrlsUsage
  return `http://${host}:${port}`;
}
