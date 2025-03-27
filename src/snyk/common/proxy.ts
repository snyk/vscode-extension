import fs from 'fs/promises';
import { Agent, AgentOptions, globalAgent } from 'https';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import * as url from 'url';

// Node-specific fetch options for Node.js 16+
interface NodeFetchOptions extends RequestInit {
  agent?: Agent | HttpsProxyAgent;
  ca?: string;
  rejectUnauthorized?: boolean;
}
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

  // Explicitly create agent with the proxy options to ensure CA certs are properly handled
  const agent = new HttpsProxyAgent(proxyOptions);
  
  // For debugging purposes
  logger.debug(`Created HTTPS proxy agent with options: ${JSON.stringify(proxyOptions)}`);
  
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

  // Ensure that if default options has CA certs, they are explicitly included
  // This is critical for proxy connections to work with custom certificates
  const proxyOptions = {
    host: proxyUrl.hostname,
    port: port,
    auth: proxyUrl.auth,
    protocol: proxyUrl.protocol,
    ...defaultOptions,
  };

  // Explicitly log what we're sending to help with debugging
  logger.debug(`Proxy options created: ${JSON.stringify({
    ...proxyOptions,
    auth: proxyOptions.auth ? '***' : undefined, // Mask auth details in logs
    ca: proxyOptions.ca ? 'Custom CA certificates included' : undefined,
  })}`);

  return proxyOptions;
}

function getVsCodeProxy(workspace: IVSCodeWorkspace): string | undefined {
  return workspace.getConfiguration<string>('http', 'proxy');
}

export async function getFetchOptions(
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
  logger: ILog,
): Promise<NodeFetchOptions> {
  // if proxying, we need to configure getHttpsProxyAgent, else configure getHttpsAgent
  let agentOptions: HttpsProxyAgent | Agent | undefined = await getHttpsProxyAgent(workspace, configuration, logger);
  if (!agentOptions) agentOptions = await getHttpsAgent(configuration, logger);
  
  // Create fetch options object
  return {
    agent: agentOptions, // Node.js fetch supports agent directly
    // Pass custom certificates from env if set
    ...(process.env.NODE_EXTRA_CA_CERTS && { ca: process.env.NODE_EXTRA_CA_CERTS }),
    // Handle SSL verification settings
    ...(configuration.getInsecure() && { rejectUnauthorized: false })
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
  defaultOptions = { rejectUnauthorized: sslCheck };
  if (!sslCheck) {
    globalAgent.options.rejectUnauthorized = false;
  } else {
    // use custom certs if provided
    if (processEnv.NODE_EXTRA_CA_CERTS) {
      try {
        logger.debug('NODE_EXTRA_CA_CERTS env var is set');
        await fs.access(processEnv.NODE_EXTRA_CA_CERTS);
        const extraCerts = await fs.readFile(processEnv.NODE_EXTRA_CA_CERTS, 'utf-8');
        if (!extraCerts) {
          return;
        }
        logger.debug('found certs in NODE_EXTRA_CA_CERTS');
        const currentCaRaw = globalAgent.options.ca ?? tls.rootCertificates;

        const currentCaArray = Array.isArray(currentCaRaw) ? currentCaRaw : [currentCaRaw];

        const mergedCa: (string | Buffer)[] = currentCaArray.map(ca => ca as string | Buffer);
        mergedCa.push(extraCerts);

        defaultOptions = { ca: mergedCa };
        globalAgent.options.ca = mergedCa;
      } catch (error) {
        logger.error(`Failed to read NODE_EXTRA_CA_CERTS file: ${error}`);
      }
    }
  }

  return defaultOptions;
}
