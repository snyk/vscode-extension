import fs from 'fs/promises';
import { AgentOptions } from 'https';
import * as tls from 'tls';
import { IConfiguration } from './configuration/configuration';
import { ILog } from './logger/interfaces';

// This simplified proxy module now only handles custom certificate configuration
// as request-light automatically handles proxy settings from VSCode

export async function getDefaultAgentOptions(
  configuration: IConfiguration,
  logger: ILog,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<AgentOptions | undefined> {
  let defaultOptions: AgentOptions | undefined;

  // Handle SSL certificate validation based on insecure setting
  const sslCheck = !configuration.getInsecure();
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

      // Get current CA certificates
      const currentCaRaw = tls.rootCertificates;
      const currentCaArray = Array.isArray(currentCaRaw) ? currentCaRaw : [currentCaRaw];
      const mergedCa: (string | Buffer)[] = currentCaArray.map(ca => ca as string | Buffer);
      mergedCa.push(extraCerts);

      // Preserve the rejectUnauthorized setting when adding custom certificates
      defaultOptions = {
        ca: mergedCa,
        rejectUnauthorized: sslCheck,
      };
    } catch (error) {
      logger.error(`Failed to read NODE_EXTRA_CA_CERTS file: ${error}`);
    }
  }

  return defaultOptions;
}
