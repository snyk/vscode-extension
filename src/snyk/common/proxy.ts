import { AxiosRequestConfig } from 'axios';
import fs from 'fs/promises';
import { Agent, AgentOptions, globalAgent } from 'https';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import * as url from 'url';
import * as tls from 'tls';
import { IConfiguration } from './configuration/configuration';
import { ILog } from './logger/interfaces';
import { IVSCodeWorkspace } from './vscode/workspace';

export async function getHttpsProxyAgent(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  logger: ILog,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<HttpsProxyAgent | undefined> {
  const proxyOptions = await getProxyOptions(workspace, configuration, logger, processEnv);
  if (proxyOptions == undefined) return undefined;

  const agent = new HttpsProxyAgent(proxyOptions);

  // Extract CA certificates from proxy agent options and add them at the top level
  if (proxyOptions.ca) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (agent as any).ca = proxyOptions.ca;
  }

  return agent;
}

export async function getProxyOptions(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  logger: ILog,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<HttpsProxyAgentOptions | undefined> {
  let proxy: string | undefined = getVsCodeProxy(workspace);

  const defaultOptions: HttpsProxyAgentOptions = {
    ...(await getDefaultAgentOptions(configuration, logger)),
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

  return {
    host: proxyUrl.hostname,
    port: port,
    auth: proxyUrl.auth,
    protocol: proxyUrl.protocol,
    ...defaultOptions,
  };
}

function getVsCodeProxy(workspace: IVSCodeWorkspace): string | undefined {
  return workspace.getConfiguration<string>('http', 'proxy');
}

export async function getAxiosConfig(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  logger: ILog,
): Promise<AxiosRequestConfig> {
  // if proxying, we need to configure getHttpsProxyAgent, else configure getHttpsAgent
  let agentOptions: HttpsProxyAgent | Agent | undefined = await getHttpsProxyAgent(workspace, configuration, logger);
  if (!agentOptions) agentOptions = await getHttpsAgent(configuration, logger);
  return {
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

async function getHttpsAgent(configuration: IConfiguration, logger: ILog): Promise<Agent> {
  return new Agent({
    ...(await getDefaultAgentOptions(configuration, logger)),
  });
}

async function getDefaultAgentOptions(
  configuration: IConfiguration,
  logger: ILog,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<AgentOptions | undefined> {
  let defaultOptions: AgentOptions | undefined;

  const sslCheck = !configuration.getInsecure();
  globalAgent.options.rejectUnauthorized = sslCheck;
  defaultOptions = { rejectUnauthorized: sslCheck };

  // Handle custom certificates if provided (both secure and insecure modes)
  if (processEnv.NODE_EXTRA_CA_CERTS) {
    try {
      logger.debug('NODE_EXTRA_CA_CERTS env var is set');
      await fs.access(processEnv.NODE_EXTRA_CA_CERTS);
      const extraCerts = await fs.readFile(processEnv.NODE_EXTRA_CA_CERTS, 'utf-8');
      if (!extraCerts) {
        return defaultOptions;
      }
      logger.debug('found certs in NODE_EXTRA_CA_CERTS');
      const currentCaRaw = globalAgent.options.ca ?? tls.rootCertificates;

      const currentCaArray = Array.isArray(currentCaRaw) ? currentCaRaw : [currentCaRaw];

      const mergedCa: (string | Buffer)[] = currentCaArray.map(ca => ca as string | Buffer);
      mergedCa.push(extraCerts);

      // Preserve the rejectUnauthorized setting when adding custom certificates
      defaultOptions = {
        ca: mergedCa,
        rejectUnauthorized: sslCheck
      };
      globalAgent.options.ca = mergedCa;
    } catch (error) {
      logger.error(`Failed to read NODE_EXTRA_CA_CERTS file: ${error}`);
    }
  }

  return defaultOptions;
}
