import { AxiosRequestConfig } from 'axios';
import fs from 'fs';
import { Agent, AgentOptions } from 'https';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import * as url from 'url';
import { Logger } from './logger/logger';
import { IVSCodeWorkspace } from './vscode/workspace';

export function getHttpsProxyAgent(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgent | undefined {
  const proxyOptions = getProxyOptions(workspace, processEnv);
  if (proxyOptions == undefined) return undefined;

  return new HttpsProxyAgent(proxyOptions);
}

export function getProxyOptions(
  workspace: IVSCodeWorkspace,
  processEnv: NodeJS.ProcessEnv = process.env,
): HttpsProxyAgentOptions | undefined {
  let proxy: string | undefined = getVsCodeProxy(workspace);

  const defaultOptions: HttpsProxyAgentOptions = {
    rejectUnauthorized: workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true,
    ...getDefaultAgentOptions(),
  };

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

  if (proxyUrl.hostname == null || proxyUrl.hostname === '') {
    return undefined;
  }

  let port;
  if (proxyUrl.port && proxyUrl.port !== '') {
    port = parseInt(proxyUrl.port, 10);
  }

  const proxyOptions: HttpsProxyAgentOptions = {
    host: proxyUrl.hostname,
    port: port,
    auth: proxyUrl.auth,
    protocol: proxyUrl.protocol,
    ...defaultOptions,
  };

  return proxyOptions;
}

export function getVsCodeProxy(workspace: IVSCodeWorkspace): string | undefined {
  return workspace.getConfiguration<string>('http', 'proxy');
}

export function getAxiosConfig(workspace: IVSCodeWorkspace): AxiosRequestConfig {
  // if proxying, we need to configure getHttpsProxyAgent, else configure getHttpsAgent
  let agentOptions: HttpsProxyAgent | Agent | undefined = getHttpsProxyAgent(workspace);
  if (!agentOptions) agentOptions = getHttpsAgent();

  return {
    // proxy false as we're using https-proxy-agent library for proxying
    proxy: false,
    httpAgent: agentOptions,
    httpsAgent: agentOptions,
  };
}

export function getProxyEnvVariable(proxyOptions: HttpsProxyAgentOptions | undefined): string | undefined {
  if (!proxyOptions) {
    return;
  }
  const { host, port, auth, protocol } = proxyOptions;
  if (!host) return;

  // noinspection HttpUrlsUsage
  return `${protocol}//${auth ? `${auth}@` : ''}${host}${port ? `:${port}` : ''}`;
}

function getVSCodeStrictProxy(workspace: IVSCodeWorkspace): boolean {
  return workspace.getConfiguration<boolean>('http', 'proxyStrictSSL') ?? true;
}

function getHttpsAgent(): Agent {
  return new Agent({
    ...getDefaultAgentOptions(),
  });
}

function getDefaultAgentOptions(processEnv: NodeJS.ProcessEnv = process.env): AgentOptions | undefined {
  let defaultOptions: AgentOptions | undefined = undefined;

  // use custom certs if provided
  if (processEnv.NODE_EXTRA_CA_CERTS) {
    try {
      fs.accessSync(processEnv.NODE_EXTRA_CA_CERTS);
      const certs = fs.readFileSync(processEnv.NODE_EXTRA_CA_CERTS);
      defaultOptions = { ca: [certs] };
    } catch (error) {
      Logger.error(`Failed to read NODE_EXTRA_CA_CERTS file: ${error}`);
    }
  }

  return defaultOptions;
}
