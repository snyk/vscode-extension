import { strictEqual } from 'assert';
import sinon from 'sinon';
import { ScanModeService } from '../../../../snyk/base/services/scanModeService';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { CodeScanMode } from '../../../../snyk/snykCode/constants/modes';

suite('ScanModeService', () => {
  let contextService: IContextService;
  let config: IConfiguration;

  setup(() => {
    contextService = {
      setContext: sinon.fake(),
    } as unknown as IContextService;
    config = {
      authHost: '',
    } as IConfiguration;
  });

  teardown(() => sinon.restore());

  test("Logs 'Scan Mode Is Selected' analytical event", async () => {
    const logScanModeIsSelectedFake = sinon.fake();
    const analytics = {
      logScanModeIsSelected: logScanModeIsSelectedFake,
    } as unknown as IAnalytics;
    const service = new ScanModeService(contextService, config, analytics);

    await service.setCodeMode(CodeScanMode.MANUAL);

    strictEqual(logScanModeIsSelectedFake.calledOnce, true);
  });

  test("Doesn't log 'Scan Mode Is Selected' analytical event for invalid scan mode", async () => {
    const logScanModeIsSelectedFake = sinon.fake();
    const analytics = {
      logScanModeIsSelected: logScanModeIsSelectedFake,
    } as unknown as IAnalytics;
    const service = new ScanModeService(contextService, config, analytics);

    await service.setCodeMode('invalid-mode' as CodeScanMode);

    strictEqual(logScanModeIsSelectedFake.called, false);
  });
});
