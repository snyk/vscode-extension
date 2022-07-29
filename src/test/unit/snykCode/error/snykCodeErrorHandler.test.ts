/* eslint-disable @typescript-eslint/no-unused-vars */
import { constants } from '@snyk/code-client';
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { ILoadingBadge } from '../../../../snyk/base/views/loadingBadge';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { CONNECTION_ERROR_RETRY_INTERVAL, MAX_CONNECTION_RETRIES } from '../../../../snyk/common/constants/general';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { SnykCodeErrorHandler } from '../../../../snyk/snykCode/error/snykCodeErrorHandler';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Snyk Code Error Handler', () => {
  const runCodeScanFake = sinon.stub().resolves();
  const baseSnykModule = {
    runCodeScan: runCodeScanFake,
  } as unknown as IBaseSnykModule;

  const handler = new SnykCodeErrorHandler(
    {} as IContextService,
    {} as ILoadingBadge,
    new LoggerMock(),
    baseSnykModule,
    {} as IConfiguration,
  );

  teardown(() => {
    sinon.restore();
  });

  test('Retries scan if "Failed to get remote bundle" is processed', async function () {
    // arrange
    this.timeout(CONNECTION_ERROR_RETRY_INTERVAL + 2000);

    const error = new Error('Failed to get remote bundle');
    // act
    await handler.processError(error, undefined, '123456789', () => null);

    strictEqual(handler.connectionRetryLimitExhausted, false);
    // assert
    return new Promise((resolve, _) => {
      setTimeout(() => {
        strictEqual(runCodeScanFake.called, true);
        resolve();
      }, CONNECTION_ERROR_RETRY_INTERVAL);
    });
  });

  test('Handles Snyk Code api error response and retries appropriately', async function () {
    this.timeout(CONNECTION_ERROR_RETRY_INTERVAL + 2000);
    const error = {
      apiName: 'getAnalysis',
      messages: {
        500: 'Unexpected server error',
      },
      errorCode: 500,
    };

    await handler.processError(error, undefined, '123456789', () => null);

    strictEqual(handler.connectionRetryLimitExhausted, false);
    // assert
    return new Promise((resolve, _) => {
      setTimeout(() => {
        strictEqual(runCodeScanFake.called, true);
        resolve();
      }, CONNECTION_ERROR_RETRY_INTERVAL);
    });
  });

  test('Logs analytic events once retries are exhausted', async function () {
    this.timeout(CONNECTION_ERROR_RETRY_INTERVAL + 2000);
    const error = new Error('Failed to get remote bundle');

    const mockedRetries = [];
    // parallelising the retries
    for (let i = 0; i < MAX_CONNECTION_RETRIES + 2; i++) {
      mockedRetries.push(handler.processError(error, undefined, '123456789', () => null));
    }
    await Promise.all(mockedRetries);

    strictEqual(handler.connectionRetryLimitExhausted, true);
  });

  test('404 is retryable error', function () {
    strictEqual(SnykCodeErrorHandler.isErrorRetryable(constants.ErrorCodes.notFound), true);
  });
});
