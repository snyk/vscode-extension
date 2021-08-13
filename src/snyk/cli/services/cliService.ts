import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../../common/logger/interfaces';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { CliExecutable } from '../cliExecutable';
import { CliProcess } from '../process';

export class CliError {
  constructor(public error: string, public path: string) {}
}

export abstract class CliService<CliResult> {
  protected abstract readonly command: string[];

  constructor(
    protected readonly extensionPath: string,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
  ) {}

  async test(): Promise<CliResult | CliError> {
    const process = new CliProcess(this.logger, this.config);

    const cliPath = CliExecutable.getPath(this.extensionPath);
    const args = this.buildArguments();

    this.logStart();

    let output: string;
    try {
      output = await process.spawn(cliPath, args);
    } catch (err) {
      const output = JSON.parse(err) as CliError;
      return new CliError(output.error, output.path); // creates new object to allow "instanceof" to work
    }

    const result = this.mapToResultType(output);
    this.logFinish();

    return result;
  }

  protected abstract mapToResultType(rawCliResult: string): CliResult;

  protected abstract logStart(): void;
  protected abstract logFinish(): void;

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
}
