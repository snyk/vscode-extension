import { CliService } from '../cli/services/cliService';
import { IConfiguration } from '../common/configuration/configuration';
import { ILog } from '../common/logger/interfaces';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { messages } from './messages/test';
import { OssResult } from './ossResult';

export class OssService extends CliService<OssResult> {
  protected readonly command: string[] = ['test'];

  constructor(
    protected readonly extensionPath: string,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
  ) {
    super(extensionPath, logger, config, workspace);
  }

  protected mapToResultType(rawCliResult: string): OssResult {
    if (rawCliResult.length == 0) {
      throw new Error('CLI returned empty output result.');
    }

    const result = JSON.parse(rawCliResult) as OssResult;

    return result;
  }

  protected logStart = (): void => this.logger.info(messages.testStarted);
  protected logFinish = (): void => this.logger.info(messages.testFinished);
}
