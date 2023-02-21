import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../../snyk/common/configuration/snykConfiguration';
import { ExperimentService } from '../../../../../snyk/common/experiment/services/experimentService';
import { CodeScanOrchestrator } from '../../../../../snyk/common/languageServer/experiments/codeScanOrchestrator';
import { ILanguageServer } from '../../../../../snyk/common/languageServer/languageServer';
import { ScanProduct, ScanStatus } from '../../../../../snyk/common/languageServer/types';
import { IContextService } from '../../../../../snyk/common/services/contextService';
import { User } from '../../../../../snyk/common/user';
import { LanguageServerMock } from '../../../mocks/languageServer.mock';
import { LoggerMock } from '../../../mocks/logger.mock';

suite.only('Code Scan Orchestrator', () => {
  let ls: ILanguageServer;
  let codeScanOrchestrator: CodeScanOrchestrator;
  let experimentService: ExperimentService;
  let user: User;
  let config: IConfiguration;
  let snykConfig: SnykConfiguration;
  let logger: LoggerMock;
  const sleepInMs = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

  setup(() => {
    ls = new LanguageServerMock();
    user = new User(undefined, undefined);
    snykConfig = new SnykConfiguration('test', 'test', 'test');
    logger = new LoggerMock();
    config = {
      shouldReportEvents: true,
    } as unknown as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Orchestrates only when check is required', async () => {
    experimentService = new ExperimentService(user, logger, config, snykConfig);
    const isUserPartOfExperimentStub = sinon.stub(experimentService, 'isUserPartOfExperiment').resolves(false);
    const contextService = sinon.fake();
    codeScanOrchestrator = new CodeScanOrchestrator(
      experimentService,
      ls,
      logger,
      contextService as unknown as IContextService,
    );

    // check is required if 10ms passed since last check
    codeScanOrchestrator.setWaitTimeInMs(10);
    await sleepInMs(5);

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
      experimentService = new ExperimentService(user, logger, config, snykConfig);
      const isUserPartOfExperimentStub = sinon.stub(experimentService, 'isUserPartOfExperiment').resolves(false);
      const contextService = sinon.fake();
      codeScanOrchestrator = new CodeScanOrchestrator(
        experimentService,
        ls,
        logger,
        contextService as unknown as IContextService,
      );

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
      experimentService = new ExperimentService(user, logger, config, snykConfig);
      const isUserPartOfExperimentStub = sinon.stub(experimentService, 'isUserPartOfExperiment').resolves(false);
      const contextService = sinon.fake();
      codeScanOrchestrator = new CodeScanOrchestrator(
        experimentService,
        ls,
        logger,
        contextService as unknown as IContextService,
      );

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
});
