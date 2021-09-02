import { AnalysisStatusProvider } from '../../common/analysis/statusProvider';
import { IConfiguration } from '../../common/configuration/configuration';
import { ILog } from '../../common/logger/interfaces';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';
import { CliExecutable } from '../cliExecutable';
import { CliProcess } from '../process';

export class CliError {
  constructor(public error: string, public path: string) {}
}

export abstract class CliService<CliResult> extends AnalysisStatusProvider {
  protected abstract readonly command: string[];
  protected result: CliResult | undefined;

  constructor(
    protected readonly extensionPath: string,
    protected readonly logger: ILog,
    protected readonly config: IConfiguration,
    protected readonly workspace: IVSCodeWorkspace,
  ) {
    super();
  }

  async test(): Promise<CliResult | CliError> {
    this.analysisStarted();
    this.beforeTest();

    const process = new CliProcess(this.logger, this.config);

    const cliPath = CliExecutable.getPath(this.extensionPath);
    const args = this.buildArguments();

    let output: string;
    try {
      output = await process.spawn(cliPath, args);
    } catch (err) {
      const output = JSON.parse(err) as CliError;
      return new CliError(output.error, output.path); // creates new object to allow "instanceof" to work
    }

    const mappedResult = this.mapToResultType(output);
    this.result = mappedResult;

    this.analysisFinished();
    this.afterTest();

    return this.result;
  }

  protected abstract mapToResultType(rawCliResult: string): CliResult;

  protected abstract beforeTest(): void;
  protected abstract afterTest(): void;

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
