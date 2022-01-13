import { strictEqual } from 'assert';
import sentryTestkit from 'sentry-testkit';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../snyk/common/configuration/snykConfiguration';
import { ErrorReporter } from '../../../../snyk/common/error/errorReporter';
import { envMock } from '../../mocks/env.mock';
import { LoggerMock } from '../../mocks/logger.mock';

suite('ErrorReporter', () => {
  const { testkit, sentryTransport } = sentryTestkit();
  const snykConfig = {
    sentryKey: 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001',
  } as SnykConfiguration;
  let configuration: IConfiguration;

  setup(async () => {
    configuration = {} as IConfiguration;
    await ErrorReporter.init(configuration, snykConfig, '', envMock, new LoggerMock(), sentryTransport);
  });

  teardown(async () => {
    await ErrorReporter.flush();
    testkit.reset();
  });

  test('Reports error when shouldReportErrors == true', done => {
    configuration.shouldReportErrors = true;
    const error = new Error('test error');

    ErrorReporter.capture(error);

    setTimeout(() => {
      strictEqual(testkit.reports().length, 1);
      strictEqual(testkit.isExist(error), true);
      done();
    }, 10);
  });

  test("Doesn't report error when shouldReportErrors == false", () => {
    configuration.shouldReportErrors = false;

    ErrorReporter.capture(new Error());

    strictEqual(testkit.reports().length, 0);
  });
});
