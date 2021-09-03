/* eslint-disable @typescript-eslint/no-unused-vars */
import { deepStrictEqual, ok } from 'assert';
import sinon from 'sinon';
import { CliProcess } from '../../../../snyk/cli/process';
import { CliError, CliService } from '../../../../snyk/cli/services/cliService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { LoggerMock } from '../../mocks/logger.mock';

interface TestCliResult {
  success: boolean;
}

class TestCliService extends CliService<TestCliResult> {
  protected command: string[] = [''];
  protected mapToResultType(_rawCliResult: string): TestCliResult {
    return { success: true };
  }
  protected beforeTest(): void {
    return;
  }
  protected afterTest(_error?: CliError): void {
    return;
  }
}

suite('CliService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let testCliService: TestCliService;

  setup(() => {
    logger = new LoggerMock();

    testCliService = new TestCliService(
      extensionPath,
      logger,
      {} as IConfiguration,
      {
        workspaceFolders: () => [''],
      } as IVSCodeWorkspace,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Test returns mapped result when CLI succeeds', async () => {
    const cliOutput = { success: true } as TestCliResult;
    sinon.stub(CliProcess.prototype, 'spawn').resolves(JSON.stringify(cliOutput));
    const result = await testCliService.test();

    deepStrictEqual(result, cliOutput);
  });

  test('Test returns error when CLI execution fails with error JSON', async () => {
    const error = new CliError('test error', '/');
    sinon.stub(CliProcess.prototype, 'spawn').rejects(JSON.stringify(error));
    const result = await testCliService.test();

    deepStrictEqual(result, error);
  });

  test('Test returns error when CLI execution fails without error JSON', async () => {
    const errOutput = new Error('Failed to run snyk command.');
    sinon.stub(CliProcess.prototype, 'spawn').rejects(errOutput);
    const result = await testCliService.test();

    ok(result instanceof CliError);
    deepStrictEqual(result.error, errOutput);
  });
});
