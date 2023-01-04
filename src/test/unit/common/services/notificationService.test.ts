import { strictEqual } from 'assert';
import sinon from 'sinon';
import { snykMessages } from '../../../../snyk/base/messages/snykMessages';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { NotificationService } from '../../../../snyk/common/services/notificationService';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IVSCodeWindow } from '../../../../snyk/common/vscode/window';
import { messages as ossMessages } from '../../../../snyk/snykOss/messages/test';
import { LoggerMock } from '../../mocks/logger.mock';

suite('NotificationService', () => {
  let commands: IVSCodeCommands;
  let configuration: IConfiguration;

  setup(() => {
    commands = {
      executeCommand: sinon.fake(),
    } as IVSCodeCommands;
  });

  teardown(() => {
    sinon.restore();
  });

  test('"Welcome Button Is Clicked" analytical event is logged', async () => {
    const logWelcomeButtonIsClickedFake = sinon.fake();
    const window = {
      showInformationMessage: () => Promise.resolve(snykMessages.welcome.button),
    } as unknown as IVSCodeWindow;
    const analytics = {
      logWelcomeButtonIsClicked: logWelcomeButtonIsClickedFake,
    } as unknown as IAnalytics;
    configuration = {
      shouldShowWelcomeNotification: true,
      hideOssBackgroundScanNotification: sinon.fake(),
    } as unknown as IConfiguration;

    const notificationService = new NotificationService(window, commands, configuration, analytics, new LoggerMock());
    await notificationService.init();

    strictEqual(logWelcomeButtonIsClickedFake.calledOnce, true);
  });
});
