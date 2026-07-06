import sinon from 'sinon';
import { TreeViewWebviewProvider } from '../../../../snyk/common/views/treeViewWebviewProvider';
import { extensionContextMock } from '../../mocks/extensionContext.mock';
import { CommandsMock } from '../../mocks/commands.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';

const commands = new CommandsMock() as unknown as IVSCodeCommands;
const logger = new LoggerMock();

suite('TreeViewWebviewProvider', () => {
  let fileReader: sinon.SinonStub;

  setup(() => {
    fileReader = sinon.stub();
    (TreeViewWebviewProvider as unknown as { instance: undefined }).instance = undefined;
  });

  teardown(() => sinon.restore());

  function makeWebviewView() {
    let html = '';
    return {
      webview: {
        options: {} as Record<string, unknown>,
        onDidReceiveMessage: sinon.stub(),
        postMessage: sinon.stub(),
        get html() {
          return html;
        },
        set html(v: string) {
          html = v;
        },
      },
    };
  }

  test('(a) HTML pushed before resolveWebviewView is applied on resolve', () => {
    fileReader.callsFake((path: string) => {
      if (path.includes('treeViewWebviewScript.js')) return 'SCRIPT';
      return '${nonce} init';
    });

    const provider = TreeViewWebviewProvider.getInstance(extensionContextMock, commands, logger, fileReader)!;
    const wv = makeWebviewView();

    provider.updateWebviewContent('<div>${ideScript}</div>');
    provider.resolveWebviewView(wv as never);

    sinon.assert.match(wv.webview.html, sinon.match('SCRIPT'));
  });

  test('(b) resolveWebviewView with no prior HTML shows init content', () => {
    fileReader.returns('${nonce} init');

    const provider = TreeViewWebviewProvider.getInstance(extensionContextMock, commands, logger, fileReader)!;
    const wv = makeWebviewView();

    provider.resolveWebviewView(wv as never);

    sinon.assert.match(wv.webview.html, sinon.match('init'));
  });

  test('(c) duplicate HTML is not re-applied', () => {
    fileReader.callsFake((path: string) => {
      if (path.includes('treeViewWebviewScript.js')) return 'SCRIPT';
      return '${nonce} init';
    });

    const provider = TreeViewWebviewProvider.getInstance(extensionContextMock, commands, logger, fileReader)!;
    const wv = makeWebviewView();
    provider.resolveWebviewView(wv as never);

    const callsAfterResolve = fileReader.callCount;

    provider.updateWebviewContent('<div>first</div>');
    provider.updateWebviewContent('<div>first</div>');

    sinon.assert.callCount(fileReader, callsAfterResolve + 1);
  });

  test('(d) applyHtml read failure logs error and falls back to init content', () => {
    fileReader.callsFake((path: string) => {
      if (path.includes('treeViewWebviewScript.js')) throw new Error('file not found');
      return '${nonce} init';
    });

    const loggerErrorSpy = sinon.spy(logger, 'error');
    const provider = TreeViewWebviewProvider.getInstance(extensionContextMock, commands, logger, fileReader)!;
    const wv = makeWebviewView();

    provider.updateWebviewContent('<div>html</div>');
    provider.resolveWebviewView(wv as never);

    sinon.assert.calledOnce(loggerErrorSpy);
    sinon.assert.match(wv.webview.html, sinon.match('init'));
  });
});
