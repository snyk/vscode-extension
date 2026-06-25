import sinon from 'sinon';
import assert from 'assert';
import { MessageHandlerFactory } from '../../../../../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { IVSCodeCommands } from '../../../../../../snyk/common/vscode/commands';
import { IConfigurationPersistenceService } from '../../../../../../snyk/common/views/workspaceConfiguration/services/configurationPersistenceService';
import { ILog } from '../../../../../../snyk/common/logger/interfaces';
import { IVSCodeWindow } from '../../../../../../snyk/common/vscode/window';

suite('MessageHandlerFactory', () => {
  let commandExecutorStub: sinon.SinonStubbedInstance<IVSCodeCommands>;
  let configPersistenceStub: sinon.SinonStubbedInstance<IConfigurationPersistenceService>;
  let loggerStub: sinon.SinonStubbedInstance<ILog>;
  let windowStub: sinon.SinonStubbedInstance<IVSCodeWindow>;
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

    windowStub = {
      showInformationMessage: sinon.stub().resolves(undefined),
    } as unknown as sinon.SinonStubbedInstance<IVSCodeWindow>;

    factory = new MessageHandlerFactory(
      commandExecutorStub as unknown as IVSCodeCommands,
      configPersistenceStub,
      loggerStub,
      windowStub as unknown as IVSCodeWindow,
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

  suite('confirmationDialog message type', () => {
    test('shows a modal and returns true tagged with callbackId when confirmed', async () => {
      (windowStub.showInformationMessage as sinon.SinonStub).resolves('Yes');

      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 'Reset all overrides for this folder?',
        callbackId: '__cb_1',
      });

      sinon.assert.calledOnceWithExactly(
        windowStub.showInformationMessage as sinon.SinonStub,
        'Reset all overrides for this folder?',
        { modal: true },
        'Yes',
      );
      assert.deepStrictEqual(result, { callbackId: '__cb_1', result: true });
    });

    test('returns false (fail-closed) when the modal is dismissed', async () => {
      (windowStub.showInformationMessage as sinon.SinonStub).resolves(undefined);

      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 'Reset?',
        callbackId: '__cb_2',
      });

      assert.deepStrictEqual(result, { callbackId: '__cb_2', result: false });
    });

    test('resolves callback with false (fail-closed) when message field is missing', async () => {
      const result = await factory.handleMessage({ type: 'confirmationDialog', callbackId: '__cb_1' });

      sinon.assert.notCalled(windowStub.showInformationMessage as sinon.SinonStub);
      sinon.assert.called(loggerStub.warn);
      assert.deepStrictEqual(result, { callbackId: '__cb_1', result: false });
    });

    test('resolves callback with false (fail-closed) when message is a non-string', async () => {
      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 123,
        callbackId: '__cb_7',
      });

      sinon.assert.notCalled(windowStub.showInformationMessage as sinon.SinonStub);
      sinon.assert.called(loggerStub.warn);
      assert.deepStrictEqual(result, { callbackId: '__cb_7', result: false });
    });

    test('resolves callback with false (fail-closed) when the modal throws', async () => {
      (windowStub.showInformationMessage as sinon.SinonStub).rejects(new Error('modal failed'));

      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 'Reset?',
        callbackId: '__cb_3',
      });

      assert.deepStrictEqual(result, { callbackId: '__cb_3', result: false });
    });

    test('drops message (no reply possible) when callbackId is missing', async () => {
      const result = await factory.handleMessage({ type: 'confirmationDialog', message: 'Reset?' });

      sinon.assert.notCalled(windowStub.showInformationMessage as sinon.SinonStub);
      sinon.assert.called(loggerStub.warn);
      assert.strictEqual(result, undefined);
    });

    test('drops message (no reply possible) when callbackId is a non-string', async () => {
      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 'Reset?',
        callbackId: 42,
      });

      sinon.assert.notCalled(windowStub.showInformationMessage as sinon.SinonStub);
      sinon.assert.called(loggerStub.warn);
      assert.strictEqual(result, undefined);
    });

    test('warns and skips when callbackId is malformed', async () => {
      const result = await factory.handleMessage({
        type: 'confirmationDialog',
        message: 'Reset?',
        callbackId: 'evil-id',
      });

      sinon.assert.notCalled(windowStub.showInformationMessage as sinon.SinonStub);
      sinon.assert.called(loggerStub.warn);
      assert.strictEqual(result, undefined);
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
