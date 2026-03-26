import { ok, strictEqual } from 'assert';
import sinon from 'sinon';
import { ExecuteCommandBridge } from '../../../../snyk/common/views/executeCommandBridge';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { ILog } from '../../../../snyk/common/logger/interfaces';

suite('ExecuteCommandBridge', () => {
  let commandExecutorStub: sinon.SinonStubbedInstance<IVSCodeCommands>;
  let loggerStub: sinon.SinonStubbedInstance<ILog>;
  let bridge: ExecuteCommandBridge;

  setup(() => {
    commandExecutorStub = {
      executeCommand: sinon.stub().resolves(undefined),
    } as unknown as sinon.SinonStubbedInstance<IVSCodeCommands>;

    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<ILog>;

    bridge = new ExecuteCommandBridge(commandExecutorStub as unknown as IVSCodeCommands, loggerStub);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('buildClientScript', () => {
    test('contains window.__ideExecuteCommand__ definition', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('window.__ideExecuteCommand__'), 'Should define __ideExecuteCommand__');
    });

    test('contains window.__ideCallbacks__ initialization', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('window.__ideCallbacks__'), 'Should initialize __ideCallbacks__');
    });

    test('posts executeCommand messages via vscode.postMessage', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes("type: 'executeCommand'"), 'Should post executeCommand messages');
      ok(script.includes('vscode.postMessage'), 'Should use vscode.postMessage');
    });

    test('includes commandResult message listener', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('commandResult'), 'Should handle commandResult messages');
      ok(script.includes("addEventListener('message'"), 'Should add message event listener');
    });

    test('includes callbackId in posted message', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('callbackId'), 'Should include callbackId in posted message');
    });
  });

  suite('handleMessage', () => {
    test('dispatches executeCommand to commandExecutor with arguments', async () => {
      await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: ['oauth2', 'https://api.snyk.io'],
      });

      sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      sinon.assert.calledWith(commandExecutorStub.executeCommand, 'snyk.login', 'oauth2', 'https://api.snyk.io');
    });

    test('returns callbackId and result when callbackId provided', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).resolves('token-value');

      const result = await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: [],
        callbackId: '__cb_1',
      });

      strictEqual(result?.callbackId, '__cb_1');
      strictEqual(result?.result, 'token-value');
    });

    test('drops callback and warns when callbackId does not match __cb_<digits> pattern', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).resolves('result');

      const result = await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: [],
        callbackId: '__proto__',
      });

      sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
      strictEqual(result, undefined);
    });

    test('accepts callbackId with multi-digit counter', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).resolves('ok');

      const result = await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.logout',
        arguments: [],
        callbackId: '__cb_42',
      });

      strictEqual(result?.callbackId, '__cb_42');
    });

    test('returns undefined when no callbackId', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).resolves('result');

      const result = await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.logout',
        arguments: [],
      });

      strictEqual(result, undefined);
    });

    test('returns undefined for non-executeCommand message type', async () => {
      const result = await bridge.handleMessage({ type: 'saveConfig', config: '{}' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      strictEqual(result, undefined);
    });

    test('warns and returns undefined when command field is missing', async () => {
      const result = await bridge.handleMessage({ type: 'executeCommand' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
      strictEqual(result, undefined);
    });

    test('handles commandExecutor errors without throwing', async () => {
      (commandExecutorStub.executeCommand as sinon.SinonStub).rejects(new Error('LS error'));

      await bridge.handleMessage({
        type: 'executeCommand',
        command: 'snyk.login',
        arguments: [],
      });

      sinon.assert.calledOnce(loggerStub.error);
    });

    test('dispatches with empty arguments when arguments field is absent', async () => {
      await bridge.handleMessage({ type: 'executeCommand', command: 'snyk.logout' });

      sinon.assert.calledWith(commandExecutorStub.executeCommand, 'snyk.logout');
    });

    test('returns undefined for null message', async () => {
      const result = await bridge.handleMessage(null);
      strictEqual(result, undefined);
      sinon.assert.notCalled(commandExecutorStub.executeCommand);
    });

    test('treats message with non-array arguments as invalid', async () => {
      await bridge.handleMessage({ type: 'executeCommand', command: 'snyk.login', arguments: 'bad' });

      sinon.assert.notCalled(commandExecutorStub.executeCommand);
      sinon.assert.called(loggerStub.warn);
    });

    suite('command allowlist', () => {
      test('rejects non-snyk commands', async () => {
        const result = await bridge.handleMessage({
          type: 'executeCommand',
          command: 'workbench.action.terminal.new',
        });

        sinon.assert.notCalled(commandExecutorStub.executeCommand);
        sinon.assert.called(loggerStub.warn);
        strictEqual(result, undefined);
      });

      test('dispatches snyk.* commands', async () => {
        await bridge.handleMessage({ type: 'executeCommand', command: 'snyk.anyCommand' });

        sinon.assert.calledOnce(commandExecutorStub.executeCommand);
      });
    });
  });
});
