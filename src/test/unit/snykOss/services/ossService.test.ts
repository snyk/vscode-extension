import { strictEqual } from 'assert';
import _ from 'lodash';
import sinon from 'sinon';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { WorkspaceTrust } from '../../../../snyk/common/configuration/trustedFolders';
import { ILog } from '../../../../snyk/common/logger/interfaces';
import { DownloadService } from '../../../../snyk/common/services/downloadService';
import { INotificationService } from '../../../../snyk/common/services/notificationService';
import { IViewManagerService } from '../../../../snyk/common/services/viewManagerService';
import { ICodeActionAdapter, ICodeActionKindAdapter } from '../../../../snyk/common/vscode/codeAction';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { IVSCodeLanguages } from '../../../../snyk/common/vscode/languages';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { OssFileResult, OssSeverity } from '../../../../snyk/snykOss/ossResult';
import { OssService } from '../../../../snyk/snykOss/services/ossService';
import { IOssSuggestionWebviewProvider } from '../../../../snyk/snykOss/views/interfaces';
import { DailyScanJob } from '../../../../snyk/snykOss/watchers/dailyScanJob';
import { LanguageServerMock } from '../../mocks/languageServer.mock';
import { LoggerMock } from '../../mocks/logger.mock';

suite('OssService', () => {
  const extensionPath = 'test/path';
  let logger: ILog;
  let ossService: OssService;

  setup(() => {
    logger = new LoggerMock();

    const ls = new LanguageServerMock();
    ls.cliReady$.next('');

    const testFolderPath = '';
    ossService = new OssService(
      {
        extensionPath,
      } as ExtensionContext,
      {
        getAdditionalCliParameters: () => '',
        getCliPath: () => undefined,
        isAutomaticDependencyManagementEnabled: () => true,
        getTrustedFolders: () => [testFolderPath],
      } as unknown as IConfiguration,
      {} as unknown as IOssSuggestionWebviewProvider,
      {} as unknown as ICodeActionAdapter,
      {} as unknown as ICodeActionKindAdapter,
      {
        refreshOssView: () => undefined,
      } as IViewManagerService,
      {
        getWorkspaceFolders: () => [testFolderPath],
      } as IVSCodeWorkspace,
      new WorkspaceTrust(),
      ls,
      {} as unknown as IVSCodeLanguages,
      logger,
      {
        logAnalysisIsReady: sinon.fake(),
      } as unknown as IAnalytics,
      {
        schedule: sinon.fake(),
      } as unknown as DailyScanJob,
      {} as DownloadService,
      {} as INotificationService,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  // test('Maps single project result correctly', async () => {
  //   const cliOutput = await fs.readFile('mocked_data/snykOss/single-project-vulnerabilities.json', 'utf-8');
  //   sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

  //   const result = await ossService.test(false, false);
  //   const expected = JSON.parse(cliOutput) as OssResult;
  //   deepStrictEqual(result, expected);
  // });

  // test('Maps multiple project results correctly', async () => {
  //   const cliOutput = await fs.readFile('mocked_data/snykOss/multi-project-vulnerabilities.json', 'utf-8');
  //   sinon.stub(CliProcess.prototype, 'spawn').resolves(cliOutput);

  //   const result = await ossService.test(false, false);
  //   const expected = JSON.parse(cliOutput) as OssResult;
  //   deepStrictEqual(result, expected);
  // });

  // test('Empty result output throws an error', async () => {
  //   sinon.stub(CliProcess.prototype, 'spawn').resolves('');
  //   await rejects(async () => await ossService.test(false, false));
  // });

  // test('Invalid JSON output throws an error', async () => {
  //   sinon.stub(CliProcess.prototype, 'spawn').resolves('{');
  //   await rejects(async () => await ossService.test(false, false));
  // });

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
