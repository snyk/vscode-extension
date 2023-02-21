import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IExtension } from '../../../../../snyk/base/modules/interfaces';
import { IConfiguration } from '../../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../../snyk/common/configuration/snykConfiguration';
import { SNYK_CONTEXT } from '../../../../../snyk/common/constants/views';
import { ExperimentService } from '../../../../../snyk/common/experiment/services/experimentService';
import { CodeScanOrchestrator } from '../../../../../snyk/common/languageServer/experiments/codeScanOrchestrator';
import { ILanguageServer } from '../../../../../snyk/common/languageServer/languageServer';
import { ScanProduct, ScanStatus } from '../../../../../snyk/common/languageServer/types';
import { IContextService } from '../../../../../snyk/common/services/contextService';
import { User } from '../../../../../snyk/common/user';
import { LanguageServerMock } from '../../../mocks/languageServer.mock';
import { LoggerMock } from '../../../mocks/logger.mock';

suite('Code Scan Orchestrator', () => {
  let ls: ILanguageServer;
  let codeScanOrchestrator: CodeScanOrchestrator;
  let experimentService: ExperimentService;
  let user: User;
  let config: IConfiguration;
  let snykConfig: SnykConfiguration;
  let logger: LoggerMock;
  let contextServiceMock: IContextService;
  let setContextSpy: sinon.SinonSpy;
  let isUserPartOfExperimentStub: sinon.SinonStub;

  const sleepInMs = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

  setup(() => {
    ls = new LanguageServerMock();
    user = new User(undefined, undefined);
    snykConfig = new SnykConfiguration('test', 'test', 'test');
    logger = new LoggerMock();
    config = {
      shouldReportEvents: true,
    } as unknown as IConfiguration;
    experimentService = new ExperimentService(user, logger, config, snykConfig);
    isUserPartOfExperimentStub = sinon.stub(experimentService, 'isUserPartOfExperiment').resolves(false);

    setContextSpy = sinon.fake();
    contextServiceMock = {
      setContext: setContextSpy,
      shouldShowCodeAnalysis: false,
      shouldShowOssAnalysis: false,
      viewContext: {},
    };

    const extension = {
      runCodeScan: sinon.fake(),
    } as unknown as IExtension;

    codeScanOrchestrator = new CodeScanOrchestrator(experimentService, ls, logger, contextServiceMock, extension);
  });

  teardown(() => {
    sinon.restore();
  });

  test('Orchestrates only when check is required', async () => {
    // check is required if 10ms passed since last check
    codeScanOrchestrator.setWaitTimeInMs(100);
    await sleepInMs(20);

    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    strictEqual(isUserPartOfExperimentStub.called, false);
  });

  for (const status in ScanStatus) {
    test(`Orchestrates only when scan is in progres - currently: ${status}`, async () => {
      codeScanOrchestrator.setWaitTimeInMs(10);
      await sleepInMs(15);

      ls.scan$.next({
        product: ScanProduct.Code,
        folderPath: 'test/path',
        issues: [],
        status: ScanStatus[status],
      });

      if (ScanStatus[status] === ScanStatus.InProgress) {
        strictEqual(isUserPartOfExperimentStub.called, true);
      } else {
        strictEqual(isUserPartOfExperimentStub.called, false);
      }
    });
  }

  for (const product in ScanProduct) {
    test(`Orchestrates only when product is code - currently: ${product}`, async () => {
      codeScanOrchestrator.setWaitTimeInMs(10);
      await sleepInMs(15);

      ls.scan$.next({
        product: ScanProduct[product],
        folderPath: 'test/path',
        issues: [],
        status: ScanStatus.InProgress,
      });

      if (ScanProduct[product] === ScanProduct.Code) {
        strictEqual(isUserPartOfExperimentStub.called, true);
      } else {
        strictEqual(isUserPartOfExperimentStub.called, false);
      }
    });
  }

  test('Correctly updates code scan settings when user is NOT part of experiment', async () => {
    codeScanOrchestrator.setWaitTimeInMs(10);
    await sleepInMs(20);

    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    // wait for the orchestrator to finish, possible race condition still exists
    await sleepInMs(20);
    sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.LS_CODE_PREVIEW, false);
  });
});
