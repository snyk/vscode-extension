import assert from 'assert';
import sinon from 'sinon';
import { MessageHandlerFactory } from '../../../../../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { IVSCodeCommands } from '../../../../../../snyk/common/vscode/commands';
import { IConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import { IConfiguration } from '../../../../../../snyk/common/configuration/configuration';
import {
  AUTH_METHOD_OAUTH,
  AUTH_METHOD_PAT,
  AUTH_METHOD_TOKEN,
} from '../../../../../../snyk/common/constants/settings';
import { AuthenticationService } from '../../../../../../snyk/base/services/authenticationService';

suite('MessageHandlerFactory', () => {
  let commandExecutorStub: sinon.SinonStubbedInstance<IVSCodeCommands>;
  let configPersistenceStub: sinon.SinonStubbedInstance<IConfigurationPersistenceService>;
  let loggerStub: sinon.SinonStubbedInstance<ILog>;
  let configStub: sinon.SinonStubbedInstance<IConfiguration>;
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

    configStub = {
      setAuthenticationMethod: sinon.stub().resolves(),
      setEndpoint: sinon.stub().resolves(),
      setInsecure: sinon.stub().resolves(),
    } as unknown as sinon.SinonStubbedInstance<IConfiguration>;

    factory = new MessageHandlerFactory(
      commandExecutorStub as unknown as IVSCodeCommands,
      configPersistenceStub,
      loggerStub,
      configStub as unknown as IConfiguration,
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
      sinon.assert.calledWith(commandExecutorStub.executeCommand, 'snyk.login', 'oauth2', 'https://api.snyk.io', false);
    });

    test('saves auth params to IDE storage when snyk.login has 3+ args', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['oauth', 'https://api.snyk.io', false],
      });

      sinon.assert.calledWith(configStub.setAuthenticationMethod as sinon.SinonStub, AUTH_METHOD_OAUTH);
      sinon.assert.calledWith(configStub.setEndpoint as sinon.SinonStub, 'https://api.snyk.io');
      sinon.assert.calledWith(configStub.setInsecure as sinon.SinonStub, false);
    });

    test('maps pat auth method to correct VS Code value', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['pat', 'https://api.snyk.io', false],
      });

      sinon.assert.calledWith(configStub.setAuthenticationMethod as sinon.SinonStub, AUTH_METHOD_PAT);
    });

    test('maps token auth method to correct VS Code value', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['token', 'https://api.snyk.io', false],
      });

      sinon.assert.calledWith(configStub.setAuthenticationMethod as sinon.SinonStub, AUTH_METHOD_TOKEN);
    });

    test('does not save auth params when snyk.login has fewer than 3 args', async () => {
      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: [],
      });

      sinon.assert.notCalled(configStub.setAuthenticationMethod as sinon.SinonStub);
      sinon.assert.notCalled(configStub.setEndpoint as sinon.SinonStub);
      sinon.assert.notCalled(configStub.setInsecure as sinon.SinonStub);
    });

    test('uses authFlowUpdatingEndpoint guard when saving endpoint', async () => {
      let flagDuringCall = false;
      (configStub.setEndpoint as sinon.SinonStub).callsFake(() => {
        flagDuringCall = AuthenticationService.isAuthFlowUpdatingEndpoint();
      });

      await factory.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['oauth', 'https://api.snyk.io', false],
      });

      assert.strictEqual(flagDuringCall, true);
      assert.strictEqual(AuthenticationService.isAuthFlowUpdatingEndpoint(), false);
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
