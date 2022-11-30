import { deepStrictEqual, rejects, strictEqual } from 'assert';
import * as fs from 'fs/promises';
import _ from 'lodash';
import { ReplaySubject } from 'rxjs';
import sinon from 'sinon';
import { CliProcess } from '../../../../snyk/cli/process';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { ILanguageServer } from '../../../../snyk/common/languageServer/languageServer';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { INotificationService } from '../../../../snyk/common/services/notificationService';
import { IViewManagerService } from '../../../../snyk/common/services/viewManagerService';
import { IWebViewProvider } from '../../../../snyk/common/views/webviewProvider';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { OssFileResult, OssResult, OssSeverity } from '../../../../snyk/snykOss/ossResult';
import { OssService } from '../../../../snyk/snykOss/services/ossService';
import { OssIssueCommandArg } from '../../../../snyk/snykOss/views/ossVulnerabilityTreeProvider';
import { DailyScanJob } from '../../../../snyk/snykOss/watchers/dailyScanJob';
import { LoggerMock } from '../../mocks/logger.mock';

suite('OssService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let ossService: OssService;

  setup(() => {
    logger = new LoggerMock();

    const ls = {
      cliReady$: new ReplaySubject<void>(1),
    } as unknown as ILanguageServer;
    ls.cliReady$.next('');

    const testFolderPath = '';
    ossService = new OssService(
      {
        extensionPath,
      } as ExtensionContext,
      logger,
      {
        getAdditionalCliParameters: () => '',
        getCliPath: () => undefined,
        isAutomaticDependencyManagementEnabled: () => true,
        getTrustedFolders: () => [testFolderPath],
      } as unknown as IConfiguration,
      {} as IWebViewProvider<OssIssueCommandArg>,
      {
        getWorkspaceFolders: () => [testFolderPath],
      } as IVSCodeWorkspace,
      {
        refreshOssView: () => undefined,
      } as IViewManagerService,
      {} as DownloadService,
      {
        schedule: sinon.fake(),
      } as unknown as DailyScanJob,
      {} as INotificationService,
      {
        logAnalysisIsReady: sinon.fake(),
      } as unknown as IAnalytics,
      ls,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Maps single project result correctly', async () => {
    const cliOutput = await fs.readFile('mocked_data/snykOss/single-project-vulnerabilities.json', 'utf-8');
    sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

    const result = await ossService.test(false, false);
    const expected = JSON.parse(cliOutput) as OssResult;
    deepStrictEqual(result, expected);
  });

  test('Maps multiple project results correctly', async () => {
    const cliOutput = await fs.readFile('mocked_data/snykOss/multi-project-vulnerabilities.json', 'utf-8');
    sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

    const result = await ossService.test(false, false);
    const expected = JSON.parse(cliOutput) as OssResult;
    deepStrictEqual(result, expected);
  });

  test('Empty result output throws an error', async () => {
    sinon.stub(CliProcess.prototype, 'spawn').resolves('');
    await rejects(async () => await ossService.test(false, false));
  });

  test('Invalid JSON output throws an error', async () => {
    sinon.stub(CliProcess.prototype, 'spawn').resolves('{');
    await rejects(async () => await ossService.test(false, false));
  });

  test('Gets new critical vulns count correctly for single project', () => {
    const oldOssResult = {
      vulnerabilities: [
        {
          id: '1',
          severity: OssSeverity.Critical,
        },
        {
          id: '2',
          severity: OssSeverity.Medium,
        },
      ],
      displayTargetFile: '',
      packageManager: '',
      projectName: '',
    } as OssFileResult;

    // Assert: latest result has same vulnerability count
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(oldOssResult, oldOssResult), 0);

    const newOssResult = {
      ..._.clone(oldOssResult),
      vulnerabilities: [
        {
          id: '1',
          severity: OssSeverity.Critical,
        },
        {
          id: '2',
          severity: OssSeverity.Medium,
        },
        {
          id: '3',
          severity: OssSeverity.Critical,
        },
        {
          id: '4',
          severity: OssSeverity.Medium,
        },
      ],
    } as OssFileResult;

    // Assert: latest result has more vulnerabilities
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(newOssResult, oldOssResult), 1);

    // Assert: latest result has less vulnerabilities
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(oldOssResult, newOssResult), 0);
  });

  test('Gets new critical vulns count correctly for multiple projects', () => {
    const oldOssResult = {
      vulnerabilities: [
        {
          id: '1',
          severity: OssSeverity.Critical,
        },
        {
          id: '2',
          severity: OssSeverity.Medium,
        },
      ],
      displayTargetFile: '',
      packageManager: '',
      projectName: '',
    } as OssFileResult;
    const oldOssResults = [oldOssResult, oldOssResult];

    // Assert: latest result has same vulnerability count
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(oldOssResults, oldOssResults), 0);

    const newOssResult = {
      ..._.clone(oldOssResult),
      vulnerabilities: [
        {
          id: '1',
          severity: OssSeverity.Critical,
        },
        {
          id: '2',
          severity: OssSeverity.Medium,
        },
        {
          id: '3',
          severity: OssSeverity.Critical,
        },
        {
          id: '4',
          severity: OssSeverity.Medium,
        },
      ],
    } as OssFileResult;
    const newOssResults = [newOssResult, newOssResult];

    // Assert: latest result has more vulnerabilities
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(newOssResults, oldOssResults), 2);

    // Assert: latest result has less vulnerabilities
    strictEqual(ossService.getNewCriticalVulnerabilitiesCount(oldOssResults, newOssResults), 0);
  });
});
