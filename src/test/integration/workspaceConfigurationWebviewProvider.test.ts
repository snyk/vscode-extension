// ABOUTME: Integration tests for WorkspaceConfigurationWebviewProvider
// ABOUTME: Tests HTML fetching and webview panel creation
import { strictEqual, ok } from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { WorkspaceConfigurationWebviewProvider } from '../../snyk/common/views/workspaceConfiguration/workspaceConfigurationWebviewProvider';
import { ExtensionContext } from '../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../unit/mocks/logger.mock';
import { IVSCodeCommands } from '../../snyk/common/vscode/commands';
import { IVSCodeWorkspace } from '../../snyk/common/vscode/workspace';
import { IConfiguration } from '../../snyk/common/configuration/configuration';
import { IHtmlInjectionService } from '../../snyk/common/views/workspaceConfiguration/services/htmlInjectionService';
import { IScopeDetectionService } from '../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { IMessageHandlerFactory } from '../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';
import { SNYK_WORKSPACE_CONFIGURATION_COMMAND } from '../../snyk/common/constants/commands';

suite('WorkspaceConfigurationWebviewProvider', () => {
  let provider: WorkspaceConfigurationWebviewProvider;
  let commandExecutorMock: IVSCodeCommands;
  let workspaceMock: IVSCodeWorkspace;
  let contextMock: ExtensionContext;
  let configurationMock: IConfiguration;
  let htmlInjectionServiceMock: IHtmlInjectionService;
  let scopeDetectionServiceMock: IScopeDetectionService;
  let messageHandlerFactoryMock: IMessageHandlerFactory;
  let logger: LoggerMock;
  let executeCommandStub: sinon.SinonStub;
  let updateConfigurationStub: sinon.SinonStub;

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

    updateConfigurationStub = sinon.stub().resolves();
    workspaceMock = {
      updateConfiguration: updateConfigurationStub,
      getConfiguration: sinon.stub(),
      getWorkspaceFolders: sinon.stub().returns([]),
    } as unknown as IVSCodeWorkspace;

    contextMock = {
      extensionPath: '/test/path',
      getExtensionUri: () => ({ fsPath: '/test/path' }),
    } as ExtensionContext;

    configurationMock = {
      setToken: sinon.stub().resolves(),
      getToken: sinon.stub().resolves(undefined),
    } as unknown as IConfiguration;

    htmlInjectionServiceMock = {
      injectIdeScripts: sinon.stub().returnsArg(0),
    } as unknown as IHtmlInjectionService;

    scopeDetectionServiceMock = {
      getSettingScope: sinon.stub().returns('default'),
      populateScopeIndicators: sinon.stub().returnsArg(0),
    } as unknown as IScopeDetectionService;

    messageHandlerFactoryMock = {
      handleMessage: sinon.stub().resolves(),
    } as unknown as IMessageHandlerFactory;

    provider = new WorkspaceConfigurationWebviewProvider(
      contextMock,
      logger,
      commandExecutorMock,
      workspaceMock,
      configurationMock,
      htmlInjectionServiceMock,
      scopeDetectionServiceMock,
      messageHandlerFactoryMock,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('fetchConfigurationHtml calls language server command', async () => {
    // Access private method for testing
    const html = await provider['fetchConfigurationHtml']();

    sinon.assert.calledOnceWithExactly(executeCommandStub, SNYK_WORKSPACE_CONFIGURATION_COMMAND);
    strictEqual(html, sampleHtml);
  });

  test('fetchConfigurationHtml returns sample HTML content', async () => {
    const html = await provider['fetchConfigurationHtml']();

    ok(html, 'HTML should not be null or undefined');
    ok(html.includes('<!DOCTYPE html>'), 'HTML should be a complete document');
    ok(html.includes('configForm'), 'HTML should contain the config form');
    ok(html.includes('save-config-btn'), 'HTML should contain save button');
  });

  test('fetchConfigurationHtml handles error gracefully', async () => {
    executeCommandStub.rejects(new Error('LS command failed'));

    const html = await provider['fetchConfigurationHtml']();

    strictEqual(html, undefined);
  });

  test('reloadIfOpen re-fetches and re-renders HTML when panel is open', async () => {
    const newHtml = '<html>fresh</html>';
    const injectedHtml = '<html>fresh-injected</html>';
    executeCommandStub.resolves(newHtml);
    // Override injectIdeScripts for this test to return a sentinel so the output assertion
    // actually verifies the pipeline ran, not just that webview.html was set to the raw fetch result.
    // resetBehavior() is required in sinon 11 to override a stub initialised with returnsArg().
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const injectStub = htmlInjectionServiceMock.injectIdeScripts as sinon.SinonStub;
    injectStub.resetBehavior();
    injectStub.returns(injectedHtml);
    const webview = { html: 'old-html' };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    await provider.reloadIfOpen();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const populateScopeIndicatorsStub = scopeDetectionServiceMock.populateScopeIndicators as sinon.SinonStub;
    sinon.assert.calledOnce(executeCommandStub);
    sinon.assert.calledOnce(populateScopeIndicatorsStub);
    sinon.assert.calledOnce(injectStub);
    strictEqual(webview.html, injectedHtml); // sentinel value — verifies pipeline ran
  });

  test('reloadIfOpen is a no-op when panel is not open', async () => {
    await provider.reloadIfOpen();

    sinon.assert.notCalled(executeCommandStub);
  });

  test('reloadIfOpen handles fetch failure without throwing', async () => {
    executeCommandStub.rejects(new Error('LS fetch failed'));
    const stubFallback = sinon.stub(provider as any, 'getFallbackHtml').rejects(new Error('no fallback'));
    const webview = { html: 'old-html' };
    provider['panel'] = { webview } as unknown as vscode.WebviewPanel;

    await provider.reloadIfOpen(); // must not throw

    strictEqual(webview.html, 'old-html'); // html unchanged
    stubFallback.restore();
  });
});
