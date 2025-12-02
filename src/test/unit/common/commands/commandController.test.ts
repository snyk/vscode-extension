import sinon from 'sinon';
import * as util from 'util';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { CommandController } from '../../../../snyk/common/commands/commandController';
import { CodeIssueData, IacIssueData } from '../../../../snyk/common/languageServer/types';
import { IOpenerService } from '../../../../snyk/common/services/openerService';
import { IProductService } from '../../../../snyk/common/services/productService';
import { CommandsMock } from '../../mocks/commands.mock';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { OssService } from '../../../../snyk/snykOss/ossService';
import { EnvMock } from '../../mocks/env.mock';
import { LanguageServerMock } from '../../mocks/languageServer.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { WindowMock } from '../../mocks/window.mock';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IFolderConfigs } from '../../../../snyk/common/configuration/folderConfigs';

suite('CommandController', () => {
  util.promisify(setTimeout);
  let controller: CommandController;
  let commandsMock: CommandsMock;
  let windowMock: WindowMock;
  let envMock: EnvMock;

  setup(() => {
    commandsMock = new CommandsMock();
    windowMock = new WindowMock();
    envMock = new EnvMock();

    controller = new CommandController(
      {} as IOpenerService,
      {} as IAuthenticationService,
      {} as IProductService<CodeIssueData>,
      {} as IProductService<IacIssueData>,
      {} as OssService,
      {} as IVSCodeWorkspace,
      commandsMock,
      windowMock,
      envMock,
      new LanguageServerMock(),
      new LoggerMock(),
      {} as IConfiguration,
      {} as IFolderConfigs,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Executes debounced command when larger than debounce pause', async () => {
    // Arrange
    const fakeFunc = sinon.fake();
    const args = ['test', 0, true];

    // Act
    await controller.executeCommand('snyk.test', fakeFunc, args);
    await controller.executeCommand('snyk.test', fakeFunc, args);

    // Assert
    sinon.assert.calledOnceWithExactly(fakeFunc, args);
  });

  test('Connectivity check displays results in modal', async () => {
    // Arrange
    const mockOutput = 'Checking for proxy configuration...\n\nTesting connectivity to Snyk endpoints...\n\n✓ All checks passed';
    commandsMock.executeCommand.withArgs('snyk.performConnectivityCheck').resolves(mockOutput);

    // Configure mock behavior
    windowMock.showInformationMessage.resolves('Copy Results to Clipboard');
    envMock.getClipboard().writeText.resolves();

    // Act
    await controller.connectivityCheck();

    // Assert
    sinon.assert.calledOnce(commandsMock.executeCommand);
    sinon.assert.calledWith(commandsMock.executeCommand, 'snyk.performConnectivityCheck');
    sinon.assert.calledOnce(windowMock.showInformationMessage);
    sinon.assert.calledWith(envMock.getClipboard().writeText, mockOutput);
  });
});
