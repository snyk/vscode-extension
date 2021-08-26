import { CliService } from '../cli/services/cliService';
import { IConfiguration } from '../common/configuration/configuration';
import { ILog } from '../common/logger/interfaces';
import { IViewManagerService } from '../common/services/viewManagerService';
import { IVSCodeWorkspace } from '../common/vscode/workspace';
import { messages } from './messages/test';
import { OssResult } from './ossResult';

// TODO: move to /services folder
export class OssService extends CliService<OssResult> {
  protected readonly command: string[] = ['test'];

  constructor(
    protected readonly extensionPath: string,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
    private readonly viewManagerService: IViewManagerService,
  ) {
    super(extensionPath, logger, config, workspace);
  }

  public getResult = (): OssResult | undefined => this.result;

  protected mapToResultType(rawCliResult: string): OssResult {
    if (rawCliResult.length == 0) {
      throw new Error('CLI returned empty output result.');
    }

    const result = JSON.parse(rawCliResult) as OssResult;

    return result;
  }

  protected beforeTest(): void {
    this.logger.info(messages.testStarted);
    this.viewManagerService.refreshOssView();
  }

  protected afterTest(): void {
    this.logger.info(messages.testFinished);
    this.viewManagerService.refreshOssView();
  }
}
