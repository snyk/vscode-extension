import { strictEqual } from 'assert';
import * as sinon from 'sinon';
import itly from '../../../../ampli';
import { Iteratively } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../snyk/common/configuration/snykConfiguration';
import { User } from '../../../../snyk/common/user';
import { LoggerMock } from '../../mocks/logger.mock';

suite('Iteratively', () => {
  const config = {
    shouldReportEvents: false,
    analyticsPermitted: false,
    isDevelopment: false,
  } as IConfiguration;
  const snykConfig = {
    segmentWriteKey: 'test',
  } as SnykConfiguration;

  suite('.load()', () => {
    suite('when analytics are permitted', () => {
      test('Returns "null" when shouldReportEvents == false', () => {
        const iteratively = new Iteratively(new User(), new LoggerMock(), config, snykConfig);

        const result = iteratively.load();

        strictEqual(result, null);
      });

      test('Returns "Iteratively" when shouldReportEvents == true', () => {
        const iteratively = new Iteratively(
          new User(),
          new LoggerMock(),
          {
            ...config,
            shouldReportEvents: true,
          },
          snykConfig,
        );

        const result = iteratively.load();

        strictEqual(result instanceof Iteratively, true);
      });
    });
  });

  suite('.enqueueEvent', () => {
    test('Enqueues event if shouldReportEvents === true and analyticsPermitted === true', () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: true,
          analyticsPermitted: true,
        },
        snykConfig,
      );
      iteratively.load();

      let eventFunctionWasCalled = false;
      iteratively.enqueueEvent(() => {
        eventFunctionWasCalled = true;
      }, false);
      strictEqual(eventFunctionWasCalled, true);
    });

    test('Does not enqueue event if shouldReportEvents === false and analyticsPermitted === true', () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: false,
          analyticsPermitted: true,
        },
        snykConfig,
      );
      iteratively.load();

      let eventFunctionWasCalled = false;
      iteratively.enqueueEvent(() => {
        eventFunctionWasCalled = true;
      }, false);
      strictEqual(eventFunctionWasCalled, false);
    });

    test('Does not enqueue event if shouldReportEvents === true and analyticsPermitted === false', () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: true,
          analyticsPermitted: false,
        },
        snykConfig,
      );
      iteratively.load();

      let eventFunctionWasCalled = false;
      iteratively.enqueueEvent(() => {
        eventFunctionWasCalled = true;
      }, false);
      strictEqual(eventFunctionWasCalled, false);
    });

    test('Does not enqueue event if shouldReportEvents === false and analyticsPermitted === false', () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: false,
          analyticsPermitted: false,
        },
        snykConfig,
      );
      iteratively.load();

      let eventFunctionWasCalled = false;
      iteratively.enqueueEvent(() => {
        eventFunctionWasCalled = true;
      }, false);
      strictEqual(eventFunctionWasCalled, false);
    });
  });

  suite('.identify', () => {
    let identify: sinon.SinonSpy;
    const user = new User();

    setup(() => {
      identify = sinon.spy(itly, 'identify');
    });

    teardown(() => {
      identify.restore();
    });

    test('Identifies a user if shouldReportEvents === true and analyticsPermitted === true', async () => {
      const iteratively = new Iteratively(
        user,
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: true,
          analyticsPermitted: true,
        },
        snykConfig,
      );
      iteratively.load();

      await iteratively.identify('test');
      strictEqual(identify.called, true);
      strictEqual(identify.calledOnce, true);
    });

    test('Does not identify a user if shouldReportEvents === true and analyticsPermitted === false', async () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: true,
          analyticsPermitted: false,
        },
        snykConfig,
      );
      iteratively.load();

      await iteratively.identify('test');
      strictEqual(identify.called, false);
      strictEqual(identify.calledOnce, false);
    });

    test('Does not identify a user if shouldReportEvents === false and analyticsPermitted === true', async () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: false,
          analyticsPermitted: true,
        },
        snykConfig,
      );
      iteratively.load();

      await iteratively.identify('test');
      strictEqual(identify.called, false);
      strictEqual(identify.calledOnce, false);
    });

    test('Does not identify a user if shouldReportEvents === false and analyticsPermitted === false', async () => {
      const iteratively = new Iteratively(
        new User(),
        new LoggerMock(),
        {
          ...config,
          shouldReportEvents: false,
          analyticsPermitted: false,
        },
        snykConfig,
      );
      iteratively.load();

      await iteratively.identify('test');
      strictEqual(identify.called, false);
      strictEqual(identify.calledOnce, false);
    });
  });
});
