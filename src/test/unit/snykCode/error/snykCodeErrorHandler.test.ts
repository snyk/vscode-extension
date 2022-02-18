/* eslint-disable @typescript-eslint/no-unused-vars */
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { ILoadingBadge } from '../../../../snyk/base/views/loadingBadge';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { CONNECTION_ERROR_RETRY_INTERVAL } from '../../../../snyk/common/constants/general';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { SnykCodeErrorHandler } from '../../../../snyk/snykCode/error/snykCodeErrorHandler';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Snyk Code Error Handler', () => {
  teardown(() => {
    sinon.restore();
  });

  test('Retries scan if "Failed to get remote bundle" is processed', async function () {
    // arrange
    this.timeout(CONNECTION_ERROR_RETRY_INTERVAL + 2000);

    const runCodeScanFake = sinon.stub().resolves();
    const baseSnykModule = ({
      runCodeScan: runCodeScanFake,
    } as unknown) as IBaseSnykModule;
    const handler = new SnykCodeErrorHandler(
      {} as IContextService,
      {} as ILoadingBadge,
      new LoggerMock(),
      baseSnykModule,
      {} as IConfiguration,
    );
    const error = new Error('Failed to get remote bundle');

    // act
    await handler.processError(error, undefined, () => null);

    // assert
    return new Promise((resolve, _) => {
      setTimeout(() => {
        strictEqual(runCodeScanFake.called, true);
        resolve();
      }, CONNECTION_ERROR_RETRY_INTERVAL);
    });
  });
});
