import * as assert from 'assert';
import sinon from 'sinon';
import * as util from 'util';
import { IAuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { CommandController, MAX_DISPLAY_LENGTH } from '../../../../snyk/common/commands/commandController';
import { CodeIssueData, IacIssueData } from '../../../../snyk/common/languageServer/types';
import { IOpenerService } from '../../../../snyk/common/services/openerService';
import { IProductService } from '../../../../snyk/common/services/productService';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';
import { OssService } from '../../../../snyk/snykOss/ossService';
import { envMock } from '../../mocks/env.mock';
import { LanguageServerMock } from '../../mocks/languageServer.mock';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IFolderConfigs } from '../../../../snyk/common/configuration/folderConfigs';

suite('CommandController', () => {
  util.promisify(setTimeout);
  let controller: CommandController;

  setup(() => {
    controller = new CommandController(
      {} as IOpenerService,
      {} as IAuthenticationService,
      {} as IProductService<CodeIssueData>,
      {} as IProductService<IacIssueData>,
      {} as OssService,
      {} as IVSCodeWorkspace,
      {} as IVSCodeCommands,
      windowMock,
      envMock,
      new LanguageServerMock(),
      new LoggerMock(),
      {} as IConfiguration,
      {} as IFolderConfigs,
    );
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

  suite('truncateForDisplay', () => {
    const tcs: {
      name: string;
      input: string;
      expected: string;
    }[] = [
      {
        name: 'returns text unchanged for short messages',
        input: 'Short error message',
        expected: 'Short error message',
      },
      {
        name: 'returns text unchanged when length equals MAX_DISPLAY_LENGTH',
        input: 'a'.repeat(MAX_DISPLAY_LENGTH),
        expected: 'a'.repeat(MAX_DISPLAY_LENGTH),
      },
      {
        name: 'returns text unchanged when length is one less than MAX_DISPLAY_LENGTH',
        input: 'a'.repeat(MAX_DISPLAY_LENGTH - 1),
        expected: 'a'.repeat(MAX_DISPLAY_LENGTH - 1),
      },
      {
        name: 'truncates text when one character over MAX_DISPLAY_LENGTH',
        input: 'a'.repeat(MAX_DISPLAY_LENGTH + 1),
        expected: 'a'.repeat(MAX_DISPLAY_LENGTH - 6) + ' [...]',
      },
      {
        name: 'truncates long text to exactly MAX_DISPLAY_LENGTH',
        input: 'a'.repeat(Math.floor(MAX_DISPLAY_LENGTH * 1.5)),
        expected: 'a'.repeat(MAX_DISPLAY_LENGTH - 6) + ' [...]',
      },
    ];
    tcs.forEach(tc => {
      test(tc.name, () => {
        // Act
        const result = controller['truncateForDisplay'](tc.input);

        // Assert
        assert.strictEqual(result, tc.expected);
      });
    });
  });
});
