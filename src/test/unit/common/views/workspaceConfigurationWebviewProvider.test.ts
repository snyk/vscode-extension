// ABOUTME: Unit tests for WorkspaceConfigurationWebviewProvider
// ABOUTME: Tests HTML fetching and webview panel creation
import { strictEqual, ok } from 'assert';
import sinon from 'sinon';
import { WorkspaceConfigurationWebviewProvider } from '../../../../snyk/common/views/workspaceConfigurationWebviewProvider';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../../mocks/logger.mock';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';

suite('WorkspaceConfigurationWebviewProvider', () => {
  let provider: WorkspaceConfigurationWebviewProvider;
  let commandExecutorMock: IVSCodeCommands;
  let contextMock: ExtensionContext;
  let logger: LoggerMock;
  let executeCommandStub: sinon.SinonStub;

  const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Test Config</title></head>
<body>
  <form id="configForm">
    <input type="text" name="endpoint" id="endpoint" value="https://api.snyk.io">
    <button id="save-config-btn">Save</button>
  </form>
</body>
</html>`;

  setup(() => {
    logger = new LoggerMock();

    executeCommandStub = sinon.stub().resolves(sampleHtml);
    commandExecutorMock = {
      executeCommand: executeCommandStub,
    } as unknown as IVSCodeCommands;

    contextMock = {
      extensionPath: '/test/path',
      getExtensionUri: () => ({ fsPath: '/test/path' } as any),
    } as ExtensionContext;

    provider = new WorkspaceConfigurationWebviewProvider(
      contextMock,
      logger,
      commandExecutorMock,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('fetchConfigurationHtml calls language server command', async () => {
    // Access private method for testing
    const html = await (provider as any).fetchConfigurationHtml();

    sinon.assert.calledOnceWithExactly(executeCommandStub, 'snyk.workspace.configuration', 'ls');
    strictEqual(html, sampleHtml);
  });

  test('fetchConfigurationHtml returns sample HTML content', async () => {
    const html = await (provider as any).fetchConfigurationHtml();

    ok(html, 'HTML should not be null or undefined');
    ok(html.includes('<!DOCTYPE html>'), 'HTML should be a complete document');
    ok(html.includes('configForm'), 'HTML should contain the config form');
    ok(html.includes('save-config-btn'), 'HTML should contain save button');
  });

  test('fetchConfigurationHtml handles error gracefully', async () => {
    executeCommandStub.rejects(new Error('LS command failed'));

    const html = await (provider as any).fetchConfigurationHtml();

    strictEqual(html, undefined);
  });

  test('processHtml returns HTML as-is for complete documents', () => {
    const processed = (provider as any).processHtml(sampleHtml);

    strictEqual(processed, sampleHtml);
  });

  test('getErrorHtml returns valid error HTML', () => {
    const errorHtml = (provider as any).getErrorHtml('Test error message');

    ok(errorHtml.includes('<!DOCTYPE html>'), 'Error HTML should be a complete document');
    ok(errorHtml.includes('Test error message'), 'Error HTML should contain error message');
  });
});
