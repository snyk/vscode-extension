import { strictEqual } from 'assert';
import sinon from 'sinon';
import { CommandsMock } from '../../mocks/commands.mock';
import { FeatureFlagService } from '../../../../snyk/common/services/featureFlagService';
import { SNYK_FEATURE_FLAG_COMMAND } from '../../../../snyk/common/constants/commands';

suite('FeatureFlagService', () => {
  let commandsMock: CommandsMock;
  let featureFlagService: FeatureFlagService;

  setup(() => {
    commandsMock = new CommandsMock();
    featureFlagService = new FeatureFlagService(commandsMock);
  });

  teardown(() => {
    sinon.restore();
  });

  test('getCodeLesson executes correct command', async () => {
    await featureFlagService.fetchFeatureFlag('test');
    strictEqual(commandsMock.executeCommand.calledOnce, true);
    strictEqual(commandsMock.executeCommand.calledWith(SNYK_FEATURE_FLAG_COMMAND, 'test'), true);
  });
});
