import { spawn } from 'child_process';
import { Configuration, IConfiguration } from '../common/configuration/configuration';
import { ILog } from '../common/logger/interfaces';
import { CLI_INTEGRATION_NAME } from './contants/integration';

export class CliProcess {
  private readonly successExitCodes = [0, 1];

  constructor(private readonly logger: ILog, private readonly config: IConfiguration) {}

  /**
   * Returns CLI output given provided arguments.
   */
  spawn(cliPath: string, args: string[]): Promise<string> {
    // todo: implement cancellation
    return new Promise((resolve, reject) => {
      let output = '';

      const cli = spawn(cliPath, args, { env: this.getProcessEnv() });

      cli.stdout.setEncoding('utf8');
      cli.stdout.on('data', (data: string | Buffer) => (output += data));

      cli.on('error', err => reject(err));
      cli.on('close', (code, signal) => {
        if (code && code in this.successExitCodes) {
          return resolve(output);
        }

        this.logger.debug(`Failure exit code ${code} received. ${signal ?? ''}.`);
        reject(output);
      });
    });
  }

  getProcessEnv(): NodeJS.ProcessEnv {
    let env = {
      SNYK_INTEGRATION_NAME: CLI_INTEGRATION_NAME,
      SNYK_INTEGRATION_VERSION: Configuration.version,
      SNYK_TOKEN: this.config.token,
      SNYK_API: this.config.snykOssApiEndpoint,
    } as NodeJS.ProcessEnv;

    if (!this.config.shouldReportEvents) {
      env = { ...env, SNYK_CFG_DISABLE_ANALYTICS: '1' };
    }
    return env;
  }
}
