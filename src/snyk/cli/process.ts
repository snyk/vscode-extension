import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { OAuthToken } from '../base/services/authenticationService';
import { Configuration, IConfiguration } from '../common/configuration/configuration';
import { ILog } from '../common/logger/interfaces';
import { getVsCodeProxy } from '../common/proxy';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { CLI_INTEGRATION_NAME } from './contants/integration';
import { CliError } from './services/cliService';

export class CliProcess {
  private runningProcess: ChildProcessWithoutNullStreams | null;

  constructor(
    private readonly logger: ILog,
    private readonly config: IConfiguration,
    private readonly workspace: IVSCodeWorkspace,
  ) {}

  /**
   * Returns CLI output given provided arguments.
   */
  async spawn(cliPath: string, cwd: string, args: readonly string[]): Promise<string> {
    const processEnv = await this.getProcessEnv();

    return new Promise((resolve, reject) => {
      let output = '';

      // file deepcode ignore ArrayMethodOnNonArray: readonly string[] is an array of strings
      this.logger.info(`Running "${cliPath} ${args.join(' ')}".`);

      this.runningProcess = spawn(cliPath, args, { env: { ...process.env, ...processEnv }, cwd });

      this.runningProcess.stdout.setEncoding('utf8');
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
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
      SNYK_API: this.config.snykOssApiEndpoint,
      SNYK_CFG_ORG: this.config.organization,
    } as NodeJS.ProcessEnv;

    const vscodeProxy = getVsCodeProxy(this.workspace);
    if (vscodeProxy && !process.env.HTTP_PROXY && !process.env.HTTPS_PROXY) {
      env = {
        ...env,
        HTTP_PROXY: vscodeProxy,
        HTTPS_PROXY: vscodeProxy,
      };
    }

    const token = await this.config.getToken();
    if (token && this.config.snykOssApiEndpoint.indexOf('snykgov.io') > 1) {
      const oauthToken = JSON.parse(token) as OAuthToken;
      env = {
        ...env,
        SNYK_OAUTH_TOKEN: oauthToken.access_token,
      };
    } else {
      env = {
        ...env,
        SNYK_TOKEN: token,
      };
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
