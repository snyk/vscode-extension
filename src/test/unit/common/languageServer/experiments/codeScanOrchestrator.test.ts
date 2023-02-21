import sinon from 'sinon';
import { IConfiguration } from '../../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../../snyk/common/configuration/snykConfiguration';
import { ExperimentService } from '../../../../../snyk/common/experiment/services/experimentService';
import { CodeScanOrchestrator } from '../../../../../snyk/common/languageServer/experiments/codeScanOrchestrator';
import { ILanguageServer } from '../../../../../snyk/common/languageServer/languageServer';
import { ScanProduct, ScanStatus } from '../../../../../snyk/common/languageServer/types';
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

  setup(() => {
    ls = new LanguageServerMock();
    user = new User(undefined, undefined);
    snykConfig = new SnykConfiguration('test', 'test', 'test');
    logger = new LoggerMock();
  });

  teardown(() => {
    sinon.restore();
  });

  test('Only when scan is in progress', () => {
    ls.scan$.next({
      product: ScanProduct.Code,
      folderPath: 'test/path',
      issues: [],
      status: ScanStatus.InProgress,
    });

    const config = {
      shouldReportEvents: true,
    } as unknown as IConfiguration;

    experimentService = new ExperimentService(user, logger, config, snykConfig);
    codeScanOrchestrator = new CodeScanOrchestrator(experimentService, ls, logger);

    // todo
  });
});
