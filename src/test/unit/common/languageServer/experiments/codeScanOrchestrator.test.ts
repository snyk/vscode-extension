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

suite('Code Scan Orchestrator', () => {
  let ls: ILanguageServer;
  let codeScanOrchestrator: CodeScanOrchestrator;
  let experimentService: ExperimentService;
  let user: User;
  let config: IConfiguration;
  let snykConfig: SnykConfiguration;
  let logger: LoggerMock;
  const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

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

  test('Orchestrates only when scan is in progress', async () => {
    experimentService = new ExperimentService(user, logger, config, snykConfig);
    const spy = sinon.stub(experimentService, 'isUserPartOfExperiment').resolves(false);
    const contextService = sinon.fake();
    codeScanOrchestrator = new CodeScanOrchestrator(
      experimentService,
      ls,
      logger,
      contextService as unknown as IContextService,
    );

    codeScanOrchestrator.setWaitTimeInMs(10);
    await sleep(15);

    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.Success,
    });

    strictEqual(spy.notCalled, true);
  });
});
