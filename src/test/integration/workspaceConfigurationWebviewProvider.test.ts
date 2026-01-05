// ABOUTME: Integration tests for WorkspaceConfigurationWebviewProvider
// ABOUTME: Tests HTML fetching and webview panel creation
import { strictEqual, ok } from 'assert';
import sinon from 'sinon';
import { WorkspaceConfigurationWebviewProvider } from '../../snyk/common/views/workspaceConfiguration/workspaceConfigurationWebviewProvider';
import { ExtensionContext } from '../../snyk/common/vscode/extensionContext';
import { LoggerMock } from '../unit/mocks/logger.mock';
import { IVSCodeCommands } from '../../snyk/common/vscode/commands';
import { IVSCodeWorkspace } from '../../snyk/common/vscode/workspace';
import { IConfiguration } from '../../snyk/common/configuration/configuration';
import { IHtmlInjectionService } from '../../snyk/common/views/workspaceConfiguration/services/htmlInjectionService';
import { IConfigurationMappingService } from '../../snyk/common/views/workspaceConfiguration/services/configurationMappingService';
import { IScopeDetectionService } from '../../snyk/common/views/workspaceConfiguration/services/scopeDetectionService';
import { IMessageHandlerFactory } from '../../snyk/common/views/workspaceConfiguration/handlers/messageHandlerFactory';

suite('WorkspaceConfigurationWebviewProvider', () => {
  let provider: WorkspaceConfigurationWebviewProvider;
  let commandExecutorMock: IVSCodeCommands;
  let workspaceMock: IVSCodeWorkspace;
  let contextMock: ExtensionContext;
  let configurationMock: IConfiguration;
  let htmlInjectionServiceMock: IHtmlInjectionService;
  let configMappingServiceMock: IConfigurationMappingService;
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

    configMappingServiceMock = {
      mapConfigToSettings: sinon.stub().returns({}),
      mapHtmlKeyToVSCodeSetting: sinon.stub().returns(undefined),
    } as unknown as IConfigurationMappingService;

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
      configMappingServiceMock,
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

    sinon.assert.calledOnceWithExactly(executeCommandStub, 'snyk.workspace.configuration', 'ls');
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

  test('injectIdeScripts injects IDE bridge functions', async () => {
    // This functionality is now in HtmlInjectionService, test it via the service
    const { HtmlInjectionService } = await import(
      '../../snyk/common/views/workspaceConfiguration/services/htmlInjectionService'
    );
    const actualService = new HtmlInjectionService();
    const processed = actualService.injectIdeScripts(sampleHtml);

    ok(processed.includes('__saveIdeConfig__'), 'Should inject save config function');
    ok(processed.includes('__ideLogin__'), 'Should inject login function');
    ok(processed.includes('__ideLogout__'), 'Should inject logout function');
    ok(processed.includes('acquireVsCodeApi'), 'Should inject VS Code API call');
  });
});
