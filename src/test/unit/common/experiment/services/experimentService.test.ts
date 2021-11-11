import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IConfiguration } from '../../../../../snyk/common/configuration/configuration';
import { SnykConfiguration } from '../../../../../snyk/common/configuration/snykConfiguration';
import { ExperimentKey, ExperimentService } from '../../../../../snyk/common/experiment/services/experimentService';
import { User } from '../../../../../snyk/common/user';
import { ExtensionContext } from '../../../../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../../../mocks/logger.mock';

suite('ExperimentService', () => {
  let user: User;
  let extensionContext: ExtensionContext;

  setup(() => {
    user = new User(undefined, undefined);
    extensionContext = {} as ExtensionContext;

    sinon.stub(SnykConfiguration, 'get').resolves({
      amplitudeExperimentApiKey: 'test',
      segmentWriteKey: 'test',
    } as SnykConfiguration);
  });

  teardown(() => {
    sinon.restore();
  });

  test("Doesn't load when event reporting is off", async () => {
    const config = ({
      shouldReportEvents: false,
    } as unknown) as IConfiguration;

    const service = new ExperimentService(user, extensionContext, new LoggerMock(), config);
    const loaded = await service.load();

    strictEqual(loaded, false);
  });

  test('User is not part of experiment when event reporting is off', async () => {
    const config = ({
      shouldReportEvents: false,
    } as unknown) as IConfiguration;

    const service = new ExperimentService(user, extensionContext, new LoggerMock(), config);

    const isUserPartOfExperiment = await service.isUserPartOfExperiment(ExperimentKey.UpdateCopyOnWelcomeView);

    strictEqual(isUserPartOfExperiment, false);
  });
});
