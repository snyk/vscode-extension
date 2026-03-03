import sinon from 'sinon';
import { MessageHandlerFactory } from '../../../../../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { IVSCodeCommands } from '../../../../../../snyk/common/vscode/commands';
import { IConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';

suite('MessageHandlerFactory', () => {
  let commandExecutorStub: sinon.SinonStubbedInstance<IVSCodeCommands>;
  let configPersistenceStub: sinon.SinonStubbedInstance<IConfigurationPersistenceService>;
  let loggerStub: sinon.SinonStubbedInstance<ILog>;
  let factory: MessageHandlerFactory;

  setup(() => {
    commandExecutorStub = {
      executeCommand: sinon.stub().resolves(undefined),
    } as unknown as sinon.SinonStubbedInstance<IVSCodeCommands>;

    configPersistenceStub = {
      handleSaveConfig: sinon.stub().resolves(),
    } as unknown as sinon.SinonStubbedInstance<IConfigurationPersistenceService>;

    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<ILog>;

    factory = new MessageHandlerFactory(
      commandExecutorStub as unknown as IVSCodeCommands,
      configPersistenceStub,
      loggerStub,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  suite('executeCommand message type', () => {
    test('routes snyk.login to commandExecutor with provided arguments', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['oauth2', 'https://api.snyk.io', false],
      });

      sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      sinon.assert.calledWith(
        commandExecutorStub.executeCommand,
        'snyk.login',
        'oauth2',
        'https://api.snyk.io',
        false,
      );
    });

    test('routes snyk.logout to commandExecutor with no arguments', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.logout',
        arguments: [],
      });

      sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      sinon.assert.calledWith(commandExecutorStub.executeCommand, 'snyk.logout');
    });

    test('routes executeCommand with undefined arguments gracefully', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
      });

      sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      sinon.assert.calledWith(commandExecutorStub.executeCommand, 'snyk.login');
    });

    test('warns and skips when command field is missing', async () => {
      await factory.handleMessage({ type: 'executeCommand' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
    });

    test('treats message with non-array arguments as invalid', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: 'not-an-array',
      });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
    });

    test('logs error and resolves when commandExecutor throws', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).rejects(new Error('command failed'));

      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: [],
      });

      sinon.assert.calledOnce(loggerStub.error);
    });
  });

  suite('saveConfig message type', () => {
    test('delegates to configPersistenceService', async () => {
      const configJson = JSON.stringify({ token: 'test-token' });

      await factory.handleMessage({ type: 'saveConfig', config: configJson });

      sinon.assert.calledOnce(configPersistenceStub.handleSaveConfig);
      sinon.assert.calledWith(configPersistenceStub.handleSaveConfig, configJson);
    });

    test('warns and skips when config field is missing', async () => {
      await factory.handleMessage({ type: 'saveConfig' });

      sinon.assert.notCalled(configPersistenceStub.handleSaveConfig);
      sinon.assert.called(loggerStub.warn);
    });
  });

  suite('removed message types', () => {
    test('login message type is no longer handled (logs warning)', async () => {
      await factory.handleMessage({ type: 'login' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
    });

    test('logout message type is no longer handled (logs warning)', async () => {
      await factory.handleMessage({ type: 'logout' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
    });
  });

  suite('invalid messages', () => {
    test('ignores null message', async () => {
      await factory.handleMessage(null);

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
    });

    test('ignores message without type', async () => {
      await factory.handleMessage({ noType: true });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
    });
  });
});
