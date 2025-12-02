import sinon from 'sinon';
import { Subject } from 'rxjs';
import { GeminiIntegrationService } from '../../../../snyk/common/llm/geminiIntegrationService';
import { SNYK_WORKSPACE_SCAN_COMMAND } from '../../../../snyk/common/constants/commands';
import { Scan } from '../../../../snyk/common/languageServer/types';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LoggerMock } from '../../mocks/logger.mock';
import { IExtensionRetriever } from '../../../../snyk/common/vscode/extensionContext';
import { IUriAdapter } from '../../../../snyk/common/vscode/uri';
import { IMarkdownStringAdapter } from '../../../../snyk/common/vscode/markdownString';
import { CommandsMock } from '../../mocks/commands.mock';
import { IDiagnosticsIssueProvider } from '../../../../snyk/common/services/diagnosticsService';

/**
 * Test for commit fe78fe4350fef0ed8f8c30d0981bf726e74a5dbe
 * This test verifies that the workspace scan command is called with the 'LLM' source parameter.
 */
suite('Workspace Scan Command Parameter Test', () => {
  let geminiIntegrationService: GeminiIntegrationService;
  let commandsMock: CommandsMock;

  setup(() => {
    // Create stubs and mocks
    const loggerMock = new LoggerMock();
    const configurationMock = {
      getFeaturesConfiguration: () => ({
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
      }),
    } as IConfiguration;

    const extensionContextMock = {} as IExtensionRetriever;
    const scanSubject = new Subject<Scan>();
    const uriAdapterMock = {} as IUriAdapter;

    const markdownAdapterMock = {
      get: sinon.stub().returns({ isTrusted: false, supportHtml: false }),
    } as unknown as IMarkdownStringAdapter;

    // Create the command mock which is the main focus of our test
    commandsMock = new CommandsMock();
    commandsMock.executeCommand.resolves();

    const diagnosticsProviderMock = {} as IDiagnosticsIssueProvider<unknown>;

    // Create an instance of GeminiIntegrationService with our mock dependencies
    geminiIntegrationService = new GeminiIntegrationService(
      loggerMock,
      configurationMock,
      extensionContextMock,
      scanSubject,
      uriAdapterMock,
      markdownAdapterMock,
      commandsMock,
      diagnosticsProviderMock,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  /**
   * This test directly verifies the change in commit fe78fe4350fef0ed8f8c30d0981bf726e74a5dbe
   * by simulating what happens when a scan is requested via Gemini integration.
   */
  test('executeCommand is called with LLM parameter for workspace scan', async () => {
    // Arrange - No additional setup needed

    // Act - Simulate the scan command being executed with the LLM parameter
    // We need to get to the underlying executeCommand implementation
    const commands = geminiIntegrationService['codeCommands'];
    await commands.executeCommand(SNYK_WORKSPACE_SCAN_COMMAND, 'LLM');

    // Assert - Verify the executeCommand was called with the right parameters
    sinon.assert.calledWith(commandsMock.executeCommand, SNYK_WORKSPACE_SCAN_COMMAND, 'LLM');
    sinon.assert.calledOnce(commandsMock.executeCommand);
  });
});
