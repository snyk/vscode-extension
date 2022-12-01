/* eslint-disable @typescript-eslint/no-unused-vars */
import { deepStrictEqual, ok } from 'assert';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { CliProcess } from '../../../../snyk/cli/process';
import { CliError, CliService } from '../../../../snyk/cli/services/cliService';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { ILanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
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
  protected ensureDependencies(): void {
    return;
  }
}

suite('CliService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let testCliService: TestCliService;
  let extensionContext: ExtensionContext;
  let downloadService: DownloadService;
  let configuration: IConfiguration;

  setup(() => {
    logger = new LoggerMock();

    extensionContext = {
      extensionPath: extensionPath,
      getGlobalStateValue: () => undefined,
    } as unknown as ExtensionContext;

    const testFolderPath = 'test-folder';
    configuration = {
      getAdditionalCliParameters: () => '',
      isAutomaticDependencyManagementEnabled: () => true,
      getCliPath: () => undefined,
      getTrustedFolders: () => [testFolderPath],
    } as unknown as IConfiguration;

    downloadService = {
      download: () => false,
      isCliInstalled: () => true,
    } as unknown as DownloadService;

    const ls = {
      cliReady$: new ReplaySubject<void>(1),
    } as unknown as ILanguageServer;
    ls.cliReady$.next('');

    testCliService = new TestCliService(
      extensionContext,
      logger,
      configuration,
      {
        getWorkspaceFolders: () => [testFolderPath],
      } as IVSCodeWorkspace,
      downloadService,
      ls,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Test returns mapped result when CLI succeeds', async () => {
    const cliOutput = { success: true } as TestCliResult;
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

    sinon.stub(CliProcess.prototype, 'spawn').resolves(JSON.stringify(cliError));

    const result = (await testCliService.test(false, false)) as CliError;

    deepStrictEqual(result.error, cliError.error);
    deepStrictEqual(result.path, cliError.path);
  });

  test('Test returns error when CLI execution fails without error JSON', async () => {
    const errOutput = new Error('Failed to run snyk command.');
    sinon.stub(CliProcess.prototype, 'spawn').rejects(errOutput);
    const result = await testCliService.test(false, false);

    ok(result instanceof CliError);
    deepStrictEqual(result.error, errOutput);
  });

  test('Test passes cwd and additional CLI arguments from settings', async () => {
    const testFolder = 'test-folder';
    const additionalParameters = `--exclude="folder with spaces" --configuration-matching="iamaRegex" --sub-project=snyk`;
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
