import { deepStrictEqual, ok, rejects } from 'assert';
import sinon from 'sinon';
import { ILog } from '../../../snyk/common/logger/interfaces';
import { LoggerMock } from '../mocks/logger.mock';
import { OssService } from '../../../snyk/snykOss/ossService';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { IVSCodeWorkspace } from '../../../snyk/common/vscode/workspace';
import * as fs from 'fs/promises';
import { OssResult } from '../../../snyk/snykOss/ossResult';
import { CliProcess } from '../../../snyk/cli/process';
import { CliError } from '../../../snyk/cli/services/cliService';
import { IViewManagerService } from '../../../snyk/common/services/viewManagerService';

suite('OssService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let ossService: OssService;

  setup(() => {
    logger = new LoggerMock();

    ossService = new OssService(
      extensionPath,
      logger,
      {} as IConfiguration,
      {
        workspaceFolders: () => [''],
      } as IVSCodeWorkspace,
      {
        refreshOssView: () => undefined,
      } as IViewManagerService,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Maps single project result correctly', async () => {
    const cliOutput = await fs.readFile('mocked_data/snykOss/single-project-vulnerabilities.json', 'utf-8');
    sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

    const result = await ossService.test();
    const expected = JSON.parse(cliOutput) as OssResult;
    deepStrictEqual(result, expected);
  });

  test('Maps multiple project results correctly', async () => {
    const cliOutput = await fs.readFile('mocked_data/snykOss/multi-project-vulnerabilities.json', 'utf-8');
    sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

    const result = await ossService.test();
    const expected = JSON.parse(cliOutput) as OssResult;
    deepStrictEqual(result, expected);
  });

  test('Empty result output throws an error', async () => {
    sinon.stub(CliProcess.prototype, 'spawn').resolves('');
    await rejects(async () => await ossService.test());
  });

  test('Invalid JSON output throws an error', async () => {
    sinon.stub(CliProcess.prototype, 'spawn').resolves('{');
    await rejects(async () => await ossService.test());
  });

  test('Returns CliError if test fails', async () => {
    const cliError = {
      ok: false,
      error: 'Authentication failed. Please check the API token on https://snyk.io',
      path: '/Users/snyk/Git/goof',
    };

    sinon.stub(CliProcess.prototype, 'spawn').rejects(JSON.stringify(cliError));

    const result = await ossService.test();

    ok(result instanceof CliError);
    deepStrictEqual(result.error, cliError.error);
    deepStrictEqual(result.path, cliError.path);
  });
});
