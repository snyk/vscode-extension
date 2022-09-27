import parseArgsStringToArgv from 'string-argv';
import { AnalysisStatusProvider } from '../../common/analysis/statusProvider';
import { IConfiguration } from '../../common/configuration/configuration';
import { ErrorHandler } from '../../common/error/errorHandler';
import { ILog } from '../../common/logger/interfaces';
import { DownloadService } from '../../common/services/downloadService';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { CliExecutable } from '../cliExecutable';
import { messages } from '../messages/messages';
import { CliProcess } from '../process';

export class CliError {
  constructor(public error: string | Error | unknown, public path?: string, public isCancellation = false) {}
}

export abstract class CliService<CliResult> extends AnalysisStatusProvider {
  protected abstract readonly command: string[];
  protected result: CliResult | CliError | undefined;

  private cliProcess?: CliProcess;
  private verifiedChecksumCorrect?: boolean;
  private _isCliDownloadSuccessful = true;

  constructor(
    protected readonly extensionContext: ExtensionContext,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
    protected readonly downloadService: DownloadService,
  ) {
    super();
  }

  get isCliDownloadSuccessful(): boolean {
    return this._isCliDownloadSuccessful;
  }

  async test(manualTrigger: boolean, reportTriggeredEvent: boolean): Promise<CliResult | CliError> {
    this.analysisStarted();
    this.beforeTest(manualTrigger, reportTriggeredEvent);
    this.result = undefined;

    const cliPath = CliExecutable.getPath(this.extensionContext.extensionPath, this.config.getCustomCliPath());

    if (this.cliProcess) {
      const killed = this.cliProcess.kill();
      if (!killed) this.logger.error('Failed to kill an already running CLI instance.');
    }

    const foldersToTest = this.workspace.getWorkspaceFolders();
    if (foldersToTest.length == 0) {
      throw new Error('No workspace was opened.');
    }

    this.cliProcess = new CliProcess(this.logger, this.config, this.workspace);
    const args = this.buildArguments(foldersToTest);

    let output: string;
    try {
      output = await this.cliProcess.spawn(cliPath, foldersToTest[0], args);
    } catch (spawnError) {
      if (spawnError instanceof CliError) {
        return spawnError;
      }

      const result = new CliError(spawnError, '');
      this.finalizeTest(result);
      return result;
    }

    const mappedResult = this.mapToResultType(output);
    this.finalizeTest(mappedResult);

    return mappedResult;
  }

  protected abstract mapToResultType(rawCliResult: string): CliResult;

  protected abstract beforeTest(manualTrigger: boolean, reportTriggeredEvent: boolean): void;
  protected abstract afterTest(result: CliResult | CliError): void;

  handleCliDownloadFailure(error: Error | unknown): void {
    this.logger.error(`${messages.cliDownloadFailed} ${ErrorHandler.stringifyError(error)}`);
    this._isCliDownloadSuccessful = false;
  }

  private buildArguments(foldersToTest: string[]): string[] {
    const args = [];

    args.push(...this.command);
    args.push(...foldersToTest);
    args.push('--json');

    const additionalParams = this.config.getAdditionalCliParameters();
    if (additionalParams) {
      args.push(...parseArgsStringToArgv(additionalParams.trim()));
    }

    return args;
  }

  // To be called to finalise the analysis
  public finalizeTest(result: CliResult | CliError): void {
    this.result = result;

    this.analysisFinished();
    this.afterTest(result);
  }
}
