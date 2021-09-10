import _ from 'lodash';
import { AnalysisStatusProvider } from '../../common/analysis/statusProvider';
import { IConfiguration } from '../../common/configuration/configuration';
import { MEMENTO_CLI_CHECKSUM } from '../../common/constants/globalState';
import { ILog } from '../../common/logger/interfaces';
import { ExtensionContext } from '../../common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { Checksum } from '../checksum';
import { CliExecutable } from '../cliExecutable';
import { CliProcess } from '../process';
import { CliDownloadService } from './cliDownloadService';

export class CliError {
  constructor(public error: string, public path?: string, public isCancellation = false) {}
}

export abstract class CliService<CliResult> extends AnalysisStatusProvider {
  protected abstract readonly command: string[];
  protected result: CliResult | undefined;

  private cliProcess?: CliProcess;
  private verifiedChecksumCorrect?: boolean;

  constructor(
    protected readonly extensionContext: ExtensionContext,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
    protected readonly downloadService: CliDownloadService
  ) {
    super();
  }

  async test(): Promise<CliResult | CliError> {
    this.analysisStarted();
    this.beforeTest();

    const cliPath = CliExecutable.getPath(this.extensionContext.extensionPath);
    const checksumCorrect = await this.isChecksumCorrect(cliPath);
    if (!checksumCorrect) {
      // Redownload CLI if corrupt,
      const downloaded = await this.downloadService.downloadCli();

      if (!downloaded) {
        const error = new CliError('Snyk CLI is corrupt and cannot be redownloaded. Please reinstall the extension or check you have access to the Internet.');
        this.finalizeTest(error);
        return error;
      }
    }

    if (this.cliProcess) {
      const killed = this.cliProcess.kill();
      if (!killed) this.logger.error('Failed to kill an already running CLI instance.');
    }

    this.cliProcess = new CliProcess(this.logger, this.config);
    const args = this.buildArguments();

    let output: string;
    try {
      output = await this.cliProcess.spawn(cliPath, args);
    } catch (spawnError) {
      if (spawnError instanceof CliError) {
        return spawnError;
      }

      let result: CliError;

      try {
        const output = JSON.parse(spawnError) as CliError;
        result = new CliError(output.error, output.path, output.isCancellation); // creates new object to allow "instanceof" to work
      } catch (parsingErr) {
        result = new CliError(spawnError, '');
      }

      this.finalizeTest(result);
      return result;
    }

    const mappedResult = this.mapToResultType(output);
    this.result = mappedResult;

    this.finalizeTest();

    return this.result;
  }

  protected abstract mapToResultType(rawCliResult: string): CliResult;

  protected abstract beforeTest(): void;
  protected abstract afterTest(error?: CliError): void;

  private buildArguments(): string[] {
    const args = [];
    const foldersToTest = this.workspace.workspaceFolders();
    if (foldersToTest.length == 0) {
      throw new Error('No workspace was opened.');
    }

    args.push(...this.command);
    args.push(...foldersToTest);
    args.push('--json');

    return args;
  }

  public async isChecksumCorrect(cliPath: string): Promise<boolean> {
    if (!_.isUndefined(this.verifiedChecksumCorrect)) {
      return this.verifiedChecksumCorrect;
    }

    const downloadedChecksum = this.extensionContext.getGlobalStateValue<string>(MEMENTO_CLI_CHECKSUM);
    if (!downloadedChecksum) {
      throw new Error('Checksum not found in the global storage.');
    }

    const checksum = await Checksum.getChecksumOf(cliPath, downloadedChecksum);
    this.verifiedChecksumCorrect = checksum.verify();

    return this.verifiedChecksumCorrect;
  }

  // To be called to finalise the analysis
  public finalizeTest(error?: CliError): void {
    this.analysisFinished();
    this.afterTest(error);
  }
}
