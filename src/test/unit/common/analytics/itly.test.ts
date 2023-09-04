import { strictEqual } from 'assert';
import { Iteratively } from '../../../../snyk/common/analytics/itly';
import { SnykConfiguration } from '../../../../snyk/common/configuration/snykConfiguration';
import { User } from '../../../../snyk/common/user';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Iteratively', () => {
  const snykConfig = {} as SnykConfiguration;
  const isDevelopment = false;

  suite('.load()', () => {
    suite('when connecting to FEDRAMP endpoints', () => {
      const isFedramp = true;
      [true, false].forEach(shouldReportEvents => {
        test(`Returns "null" when shouldReportEvents == ${shouldReportEvents}`, () => {
          const iteratively = new Iteratively(
            new User(),
            new LoggerMock(),
            shouldReportEvents,
            isFedramp,
            isDevelopment,
            snykConfig,
          );

          const result = iteratively.load();

          strictEqual(result, null);
        });
      });
    });

    suite('when connecting to non-FEDRAMP endpoints', () => {
      const isFedramp = false;

      test('Returns "null" when shouldReportEvents == false', () => {
        const iteratively = new Iteratively(new User(), new LoggerMock(), false, isFedramp, isDevelopment, snykConfig);

        const result = iteratively.load();

        strictEqual(result, null);
      });

      test('Returns "Iteratively" when shouldReportEvents == true', () => {
        const iteratively = new Iteratively(new User(), new LoggerMock(), true, isFedramp, isDevelopment, snykConfig);

        const result = iteratively.load();

        strictEqual(result instanceof Iteratively, true);
      });
    });
  });
});
