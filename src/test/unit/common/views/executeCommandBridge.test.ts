import { ok, strictEqual } from 'assert';
import * as vm from 'vm';
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

    test('includes messageResult message listener', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('messageResult'), 'Should handle messageResult messages');
      ok(script.includes("addEventListener('message'"), 'Should add message event listener');
    });

    test('includes callbackId in posted message', () => {
      const script = ExecuteCommandBridge.buildClientScript();
      ok(script.includes('callbackId'), 'Should include callbackId in posted message');
    });
  });

  // Executes the injected client JS in a sandbox so a string-JS typo (which substring checks
  // would not catch) actually fails a test, and the callback round-trip is proven end-to-end.
  suite('buildClientScript (executed in sandbox)', () => {
    interface PostedMessage {
      type: string;
      command?: string;
      arguments?: unknown[];
      callbackId: string | null;
    }
    interface FakeWindow {
      addEventListener(type: string, fn: (e: { data: unknown }) => void): void;
      __ideRegisterCallback__(callback: unknown): string | null;
      __ideResolveCallback__(callbackId: string, result: unknown): void;
      __ideExecuteCommand__(cmd: string, args: unknown[], callback?: (result: unknown) => void): void;
    }

    function runClientScript(): {
      window: FakeWindow;
      posted: PostedMessage[];
      dispatchMessage: (data: unknown) => void;
    } {
      const posted: PostedMessage[] = [];
      const listeners: ((e: { data: unknown }) => void)[] = [];
      const window = {
        addEventListener: (type: string, fn: (e: { data: unknown }) => void) => {
          if (type === 'message') listeners.push(fn);
        },
      } as unknown as FakeWindow;
      const vscode = { postMessage: (m: PostedMessage) => posted.push(m) };

      vm.runInNewContext(ExecuteCommandBridge.buildClientScript(), { window, vscode });

      return { window, posted, dispatchMessage: data => listeners.forEach(fn => fn({ data })) };
    }

    test('__ideRegisterCallback__ returns sequential ids for functions, null otherwise', () => {
      const { window } = runClientScript();
      strictEqual(
        window.__ideRegisterCallback__(() => {
          /* noop */
        }),
        '__cb_1',
      );
      strictEqual(
        window.__ideRegisterCallback__(() => {
          /* noop */
        }),
        '__cb_2',
      );
      strictEqual(window.__ideRegisterCallback__(undefined), null);
      strictEqual(window.__ideRegisterCallback__('not-a-function'), null);
    });

    test('__ideExecuteCommand__ posts callbackId and a messageResult reply resolves the callback', () => {
      const { window, posted, dispatchMessage } = runClientScript();
      let received: unknown = 'unset';
      window.__ideExecuteCommand__('snyk.x', [1, 2], r => {
        received = r;
      });

      strictEqual(posted.length, 1);
      strictEqual(posted[0].type, 'executeCommand');
      strictEqual(posted[0].command, 'snyk.x');
      const cbId = posted[0].callbackId as string;
      ok(/^__cb_\d+$/.test(cbId), 'posts a well-formed callbackId');

      dispatchMessage({ type: 'messageResult', callbackId: cbId, result: 'done' });
      strictEqual(received, 'done');
    });

    test('__ideExecuteCommand__ posts callbackId null when no callback is given', () => {
      const { window, posted } = runClientScript();
      window.__ideExecuteCommand__('snyk.x', []);
      strictEqual(posted[0].callbackId, null);
    });

    test('a callback is invoked at most once (one-shot resolve)', () => {
      const { window, posted, dispatchMessage } = runClientScript();
      let count = 0;
      window.__ideExecuteCommand__('snyk.x', [], () => {
        count++;
      });
      const cbId = posted[0].callbackId as string;
      dispatchMessage({ type: 'messageResult', callbackId: cbId, result: true });
      dispatchMessage({ type: 'messageResult', callbackId: cbId, result: true });
      strictEqual(count, 1);
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
