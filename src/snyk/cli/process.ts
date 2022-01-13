import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { Configuration, IConfiguration } from '../common/configuration/configuration';
import { ILog } from '../common/logger/interfaces';
import { CLI_INTEGRATION_NAME } from './contants/integration';
import { CliError } from './services/cliService';

export class CliProcess {
  private readonly successExitCodes = [0, 1];

  private runningProcess: ChildProcessWithoutNullStreams | null;

  constructor(private readonly logger: ILog, private readonly config: IConfiguration) {}

  /**
   * Returns CLI output given provided arguments.
   */
  async spawn(cliPath: string, args: readonly string[]): Promise<string> {
    const processEnv = await this.getProcessEnv();

    return new Promise((resolve, reject) => {
      let output = '';

      this.logger.info(`Running "${cliPath} ${args.join(' ')}".`);

      this.runningProcess = spawn(cliPath, args, { env: { ...process.env, ...processEnv } });

      this.runningProcess.stdout.setEncoding('utf8');
      this.runningProcess.stdout.on('data', (data: string | Buffer) => (output += data));

      this.runningProcess.on('error', err => {
        this.cleanupProcess();
        reject(err);
      });
      this.runningProcess.on('close', (_, signal) => {
        this.cleanupProcess();

        // Cancellation process kill was issued
        if (signal === 'SIGTERM') {
          return reject(new CliError('', '', true));
        }

        // Treat as succesful termination
        resolve(output);
      });
    });
  }

  kill(): boolean {
    return !this.runningProcess || this.runningProcess.kill('SIGTERM');
  }

  async getProcessEnv(): Promise<NodeJS.ProcessEnv> {
    let env = {
      SNYK_INTEGRATION_NAME: CLI_INTEGRATION_NAME,
      SNYK_INTEGRATION_VERSION: await Configuration.getVersion(),
      SNYK_TOKEN: this.config.token,
      SNYK_API: this.config.snykOssApiEndpoint,
      SNYK_CFG_ORG: this.config.organization,
    } as NodeJS.ProcessEnv;

    if (!this.config.shouldReportEvents) {
      env = { ...env, SNYK_CFG_DISABLE_ANALYTICS: '1' };
    }
    return env;
  }

  private cleanupProcess() {
    if (this.runningProcess) {
      this.runningProcess.removeAllListeners();
      this.runningProcess = null;
    }
  }
}
