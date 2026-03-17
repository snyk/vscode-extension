import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { FeatureFlagService } from '../../../../snyk/common/services/featureFlagService';
import { SNYK_FEATURE_FLAG_COMMAND } from '../../../../snyk/common/constants/commands';
import { LogMockFailOnErrors } from '../../mocks/logger.mock';

suite('FeatureFlagService', () => {
  let commands: IVSCodeCommands;
  const executeCommandFake = sinon.fake();
  const logger = new LogMockFailOnErrors();

  setup(() => {
    executeCommandFake.resetHistory();
    commands = {
      executeCommand: executeCommandFake,
    } as IVSCodeCommands;
  });

  teardown(() => {
    sinon.restore();
  });

  test('getCodeLesson executes correct command', async () => {
    const featureFlagService = new FeatureFlagService(commands, logger);

    await featureFlagService.fetchFeatureFlag('test');
    strictEqual(executeCommandFake.calledOnce, true);
    strictEqual(executeCommandFake.calledWith(SNYK_FEATURE_FLAG_COMMAND, 'test'), true);
  });
});
