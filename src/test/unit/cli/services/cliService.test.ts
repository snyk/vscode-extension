/* eslint-disable @typescript-eslint/no-unused-vars */
import { deepStrictEqual, notStrictEqual, ok, rejects, strictEqual } from 'assert';
import sinon from 'sinon';
import { Checksum } from '../../../../snyk/cli/checksum';
import { CliProcess } from '../../../../snyk/cli/process';
import { CliDownloadService } from '../../../../snyk/cli/services/cliDownloadService';
import { CliError, CliService } from '../../../../snyk/cli/services/cliService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { LoggerMock } from '../../mocks/logger.mock';

type TestCliResult =
  | {
      success: boolean;
    }
  | CliError;

class TestCliService extends CliService<TestCliResult> {
  protected command: string[] = [''];
  protected mapToResultType(rawCliResult: string): TestCliResult {
    return JSON.parse(rawCliResult) as TestCliResult;
  }
  protected beforeTest(): void {
    return;
  }
  protected afterTest(_result: TestCliResult): void {
    return;
  }
}

suite('CliService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let testCliService: TestCliService;
  let extensionContext: ExtensionContext;
  let cliDownloadService: CliDownloadService;
  let configuration: IConfiguration;

  setup(() => {
    logger = new LoggerMock();

    extensionContext = {
      extensionPath: extensionPath,
      getGlobalStateValue: () => undefined,
    } as unknown as ExtensionContext;

    configuration = {
      getAdditionalCliParameters: () => '',
    } as unknown as IConfiguration;

    cliDownloadService = {
      downloadCli: () => false,
      isInstalled: () => true,
    } as unknown as CliDownloadService;

    testCliService = new TestCliService(
      extensionContext,
      logger,
      configuration,
      {
        getWorkspaceFolders: () => ['test-folder'],
      } as IVSCodeWorkspace,
      cliDownloadService,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Test returns mapped result when CLI succeeds', async () => {
    const cliOutput = { success: true } as TestCliResult;
    sinon.stub(testCliService, 'isChecksumCorrect').resolves(true);
    sinon.stub(CliProcess.prototype, 'spawn').resolves(JSON.stringify(cliOutput));
    const result = await testCliService.test(false, false);

    deepStrictEqual(result, cliOutput);
  });

  test('Test returns error when CLI execution fails with error JSON', async () => {
    const cliError = {
      ok: false,
      error: 'Authentication failed. Please check the API token on https://snyk.io',
      path: '/Users/snyk/Git/goof',
    };

    sinon.stub(testCliService, 'isChecksumCorrect').resolves(true);
    sinon.stub(CliProcess.prototype, 'spawn').resolves(JSON.stringify(cliError));

    const result = (await testCliService.test(false, false)) as CliError;

    deepStrictEqual(result.error, cliError.error);
    deepStrictEqual(result.path, cliError.path);
  });

  test('Test returns error when CLI execution fails without error JSON', async () => {
    const errOutput = new Error('Failed to run snyk command.');
    sinon.stub(testCliService, 'isChecksumCorrect').resolves(true);
    sinon.stub(CliProcess.prototype, 'spawn').rejects(errOutput);
    const result = await testCliService.test(false, false);

    ok(result instanceof CliError);
    deepStrictEqual(result.error, errOutput);
  });

  test('Test tries redownloading CLI when checksum verification fails', async () => {
    sinon.stub(testCliService, 'isChecksumCorrect').resolves(false);
    const download = sinon.stub(cliDownloadService, 'downloadCli').resolves(true);
    await testCliService.test(false, false);
    deepStrictEqual(download.calledOnce, true);
  });

  test('Test returns error when CLI checksum verification fails', async () => {
    sinon.stub(testCliService, 'isChecksumCorrect').resolves(false);
    sinon.stub(cliDownloadService, 'downloadCli').resolves(false);
    const result = await testCliService.test(false, false);

    ok(result instanceof CliError);
  });

  test('isChecksumCorrect returns error when checksum not captured in global storage', async () => {
    sinon.stub(extensionContext, 'getGlobalStateValue').returns(1);
    await rejects(async () => await testCliService.isChecksumCorrect('test/path'));
  });

  test('isChecksumCorrect returns true when CLI checksum matches the stored one', async () => {
    const checksumStr = 'e06fa5f8d963e8a3e2f9d1bfcf5f66d412ce4d5ad60e24512cfe8a65e7077d88';
    sinon.stub(extensionContext, 'getGlobalStateValue').returns(checksumStr);
    sinon.stub(Checksum, 'getChecksumOf').resolves(Checksum.fromDigest(checksumStr, checksumStr));

    const result = await testCliService.isChecksumCorrect('test/path');
    strictEqual(result, true);
  });

  test("isChecksumCorrect returns false when CLI checksum don't match", async () => {
    const checksumStr = 'e06fa5f8d963e8a3e2f9d1bfcf5f66d412ce4d5ad60e24512cfe8a65e7077d88';
    const returnedChecksumStr = 'e06fa5f8d963e8a3e2f9d1bfcf5f66d412ce4d5ad60e24512cfe8a65e7077d88';

    sinon.stub(extensionContext, 'getGlobalStateValue').returns(checksumStr);
    sinon.stub(Checksum, 'getChecksumOf').resolves(Checksum.fromDigest(returnedChecksumStr, checksumStr));

    const result = await testCliService.isChecksumCorrect('test/path');
    notStrictEqual(result, false);
  });

  test('isChecksumCorrect returns true when CLI file is installed and checksum correct', async () => {
    const checksumStr = 'e06fa5f8d963e8a3e2f9d1bfcf5f66d412ce4d5ad60e24512cfe8a65e7077d88';
    sinon.stub(extensionContext, 'getGlobalStateValue').returns(checksumStr);
    sinon.stub(Checksum, 'getChecksumOf').resolves(Checksum.fromDigest(checksumStr, checksumStr));

    const result = await testCliService.isChecksumCorrect('test/path');

    strictEqual(result, true);
  });

  test('isChecksumCorrect returns false when CLI file is not installed', async () => {
    sinon.stub(cliDownloadService, 'isInstalled').resolves(false);
    const result = await testCliService.isChecksumCorrect('test/path');
    strictEqual(result, false);
  });

  test("isChecksumCorrect doesn't calculate checksum twice after first time verification", async () => {
    const checksumStr = 'e06fa5f8d963e8a3e2f9d1bfcf5f66d412ce4d5ad60e24512cfe8a65e7077d88';
    const getGlobalStateValueSpy = sinon.stub(extensionContext, 'getGlobalStateValue').returns(checksumStr);
    const getChecksumOfSpy = sinon.stub(Checksum, 'getChecksumOf').resolves(Checksum.fromDigest('s', checksumStr));

    await testCliService.isChecksumCorrect('test/path');
    await testCliService.isChecksumCorrect('test/path');

    strictEqual(getGlobalStateValueSpy.calledOnce, true);
    strictEqual(getChecksumOfSpy.calledOnce, true);
  });

  test('Test passes cwd and additional CLI arguments from settings', async () => {
    const testFolder = 'test-folder';
    const additionalParameters = `--exclude="folder with spaces" --configuration-matching="iamaRegex" --sub-project=snyk`;
    sinon.stub(testCliService, 'isChecksumCorrect').resolves(true);
    sinon.stub(configuration, 'getAdditionalCliParameters').returns(additionalParameters);

    const spawnSpy = sinon.spy(CliProcess.prototype, 'spawn');
    await testCliService.test(false, false);

    const expectedArgs = [
      '',
      testFolder,
      '--json',
      '--exclude="folder with spaces"',
      '--configuration-matching="iamaRegex"',
      '--sub-project=snyk',
    ];
    deepStrictEqual(spawnSpy.calledWith(sinon.match.any, testFolder, expectedArgs), true);
  });
});
