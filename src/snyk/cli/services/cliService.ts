import { firstValueFrom } from 'rxjs';
import parseArgsStringToArgv from 'string-argv';
import { AnalysisStatusProvider } from '../../common/analysis/statusProvider';
import { IConfiguration } from '../../common/configuration/configuration';
import { getTrustedFolders } from '../../common/configuration/trustedFolders';
import { ErrorHandler } from '../../common/error/errorHandler';
import { ILanguageServer } from '../../common/languageServer/languageServer';
import { ILog } from '../../common/logger/interfaces';
import { messages as analysisMessages } from '../../common/messages/analysisMessages';
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
  private _isLsDownloadSuccessful = true;
  private _isCliReady: boolean;
  private _isAnyWorkspaceFolderTrusted = true;

  constructor(
    protected readonly extensionContext: ExtensionContext,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
    protected readonly downloadService: DownloadService,
    protected readonly languageServer: ILanguageServer,
  ) {
    super();
  }

  get isLsDownloadSuccessful(): boolean {
    return this._isLsDownloadSuccessful;
  }

  get isCliReady(): boolean {
    return this._isCliReady;
  }

  get isAnyWorkspaceFolderTrusted(): boolean {
    return this._isAnyWorkspaceFolderTrusted;
  }

  async test(manualTrigger: boolean, reportTriggeredEvent: boolean): Promise<CliResult | CliError | void> {
    this.ensureDependencies();

    const currentCliPath = CliExecutable.getPath(this.extensionContext.extensionPath, this.config.getCliPath());
    const currentCliPathExists = await CliExecutable.exists(
      this.extensionContext.extensionPath,
      this.config.getCliPath(),
    );
    await this.synchronizeCliPathIfNeeded(currentCliPath, currentCliPathExists);
    if (currentCliPathExists) {
      const cliPath = this.config.getCliPath();
      if (!cliPath) {
        throw new Error('CLI path is not set, probably failed migration.');
      }

      this.logger.info(`Using CLI path ${cliPath}`);
      this.languageServer.cliReady$.next(cliPath);
    }

    // Prevent from CLI scan until Language Server downloads the CLI.
    const cliPath = await firstValueFrom(this.languageServer.cliReady$);
    this._isCliReady = true;

    let foldersToTest = this.workspace.getWorkspaceFolders();
    if (foldersToTest.length == 0) {
      throw new Error('No workspace was opened.');
    }

    foldersToTest = getTrustedFolders(this.config, foldersToTest);
    if (foldersToTest.length == 0) {
      this.handleNoTrustedFolders();
      this.logger.info(`Skipping Open Source scan. ${analysisMessages.noWorkspaceTrustDescription}`);
      return;
    }
    this._isAnyWorkspaceFolderTrusted = true;

    // Start test
    this.analysisStarted();
    this.beforeTest(manualTrigger, reportTriggeredEvent);
    this.result = undefined;

    if (this.cliProcess) {
      const killed = this.cliProcess.kill();
      if (!killed) this.logger.error('Failed to kill an already running CLI instance.');
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

  // Synchronizes user configuration with CLI path passed to the Snyk LS.
  // TODO: Remove in VS Code + Language Server feature cleanup.
  private async synchronizeCliPathIfNeeded(cliPath: string, cliPathExists: boolean) {
    if (!this.config.getCliPath() && cliPathExists) {
      this.logger.info("Synchronising extension's CLI path with Language Server");
      try {
        await this.config.setCliPath(cliPath);
      } catch (e) {
        ErrorHandler.handle(e, this.logger, "Failed to synchronize extension's CLI path with Language Server");
      }
    }

    return cliPath;
  }

  protected abstract mapToResultType(rawCliResult: string): CliResult;

  protected abstract ensureDependencies(): void;

  protected abstract beforeTest(manualTrigger: boolean, reportTriggeredEvent: boolean): void;
  protected abstract afterTest(result: CliResult | CliError): void;

  handleLsDownloadFailure(error: Error | unknown): void {
    this.logger.error(`${messages.lsDownloadFailed} ${ErrorHandler.stringifyError(error)}`);
    this._isLsDownloadSuccessful = false;
  }

  handleNoTrustedFolders() {
    this._isAnyWorkspaceFolderTrusted = false;
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
