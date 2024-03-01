import { Experiment, RemoteEvaluationClient } from '@amplitude/experiment-node-server';
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../../snyk/common/configuration/snykConfiguration';
import { ExperimentKey, ExperimentService } from '../../../../../snyk/common/experiment/services/experimentService';
import { User } from '../../../../../snyk/common/user';
import { LoggerMock } from '../../../mocks/logger.mock';

suite('ExperimentService', () => {
  let user: User;
  let fetchStub: sinon.SinonStub;

  setup(() => {
    user = new User(undefined, undefined, new LoggerMock());

    sinon.stub(SnykConfiguration, 'get').resolves({
      amplitudeExperimentApiKey: 'test',
    } as SnykConfiguration);

    fetchStub = sinon.stub();
    sinon.stub(Experiment, 'initialize').returns({
      fetch: fetchStub,
    } as unknown as RemoteEvaluationClient);
  });

  teardown(() => {
    sinon.restore();
  });

  test("Doesn't load when event reporting is off", () => {
    const config = {
      shouldReportEvents: false,
    } as unknown as IConfiguration;

    const service = new ExperimentService(user, new LoggerMock(), config);
    const loaded = service.load();

    strictEqual(loaded, false);
  });

  test('User is not part of experiment when event reporting is off', async () => {
    const config = {
      shouldReportEvents: false,
    } as unknown as IConfiguration;

    const service = new ExperimentService(user, new LoggerMock(), config);

    const isUserPartOfExperiment = await service.isUserPartOfExperiment(ExperimentKey.TestExperiment);

    strictEqual(isUserPartOfExperiment, false);
  });

  test('Should force a fetch of variants even if cache is available', async () => {
    const config = {
      shouldReportEvents: true,
    } as unknown as IConfiguration;

    const snykConfig = new SnykConfiguration('test', 'test');
    const service = new ExperimentService(user, new LoggerMock(), config, snykConfig);
    service.load();

    fetchStub.returns({});

    await service.isUserPartOfExperiment(ExperimentKey.TestExperiment);
    await service.isUserPartOfExperiment(ExperimentKey.TestExperiment, true);

    strictEqual(fetchStub.callCount, 2);
  });

  test('Should use cached variants by default', async () => {
    const config = {
      shouldReportEvents: true,
    } as unknown as IConfiguration;

    const snykConfig = new SnykConfiguration('test', 'test');
    const service = new ExperimentService(user, new LoggerMock(), config, snykConfig);
    service.load();

    fetchStub.returns({});

    await service.isUserPartOfExperiment(ExperimentKey.TestExperiment);
    await service.isUserPartOfExperiment(ExperimentKey.TestExperiment);

    strictEqual(fetchStub.callCount, 1);
  });
});
