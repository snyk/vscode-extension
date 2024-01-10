import { strictEqual } from 'assert';
import { Iteratively } from '../../../../snyk/common/analytics/itly';
import { SnykConfiguration } from '../../../../snyk/common/configuration/snykConfiguration';
import { User } from '../../../../snyk/common/user';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Iteratively', () => {
  const snykConfig = {} as SnykConfiguration;
  const isDevelopment = false;

  suite('.load()', () => {
    suite('when analytics are not permitted', () => {
      const analyticsPermitted = false;
      [true, false].forEach(shouldReportEvents => {
        test(`Returns "null" when shouldReportEvents == ${shouldReportEvents}`, () => {
          const iteratively = new Iteratively(
            new User(),
            new LoggerMock(),
            shouldReportEvents,
            analyticsPermitted,
            isDevelopment,
            snykConfig,
          );

          const result = iteratively.load();

          strictEqual(result, null);
        });
      });
    });

    suite('when analytics are permitted', () => {
      const analyticsPermitted = true;

      test('Returns "null" when shouldReportEvents == false', () => {
        const iteratively = new Iteratively(
          new User(),
          new LoggerMock(),
          false,
          analyticsPermitted,
          isDevelopment,
          snykConfig,
        );

        const result = iteratively.load();

        strictEqual(result, null);
      });

      test('Returns "Iteratively" when shouldReportEvents == true', () => {
        const iteratively = new Iteratively(
          new User(),
          new LoggerMock(),
          true,
          analyticsPermitted,
          isDevelopment,
          snykConfig,
        );

        const result = iteratively.load();

        strictEqual(result instanceof Iteratively, true);
      });
    });
  });
});
