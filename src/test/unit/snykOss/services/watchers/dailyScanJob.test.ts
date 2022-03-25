import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IExtension } from '../../../../../snyk/base/modules/interfaces';
import { DailyScanJob } from '../../../../../snyk/snykOss/watchers/dailyScanJob';

suite('OSS DailyScanJob', () => {
  let extension: IExtension;
  let clock: sinon.SinonFakeTimers;
  let ossScanSpy: sinon.SinonSpy;

  setup(() => {
    ossScanSpy = sinon.fake();
    extension = {
      runOssScan: ossScanSpy,
    } as unknown as IExtension;
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    sinon.restore();
    clock;
  });

  test('Runs a scan after 24 hours have passed', () => {
    const job = new DailyScanJob(extension);
    job.schedule();

    clock.tick(86400000);
    strictEqual(ossScanSpy.calledOnce, true);
  });

  test("Doesn't run scan before 24 hours have passed", () => {
    const job = new DailyScanJob(extension);
    job.schedule();

    clock.tick(86399999);
    strictEqual(ossScanSpy.calledOnce, false);
  });

  test('24h timer is reset when new schedule happens', () => {
    const job = new DailyScanJob(extension);
    job.schedule();

    clock.tick(86399999);
    strictEqual(ossScanSpy.called, false);

    job.schedule();

    clock.tick(86399999);
    strictEqual(ossScanSpy.called, false);

    clock.tick(1);
    strictEqual(ossScanSpy.calledOnce, true);
  });
});
