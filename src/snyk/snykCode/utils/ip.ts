import * as dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

export async function getIpFamily(hostname: string): Promise<string | undefined> {
  try {
    const result = await lookupAsync(hostname);
    return result.family === 4 ? '4' : '6';
  } catch (error) {
    return undefined;
  }
}
