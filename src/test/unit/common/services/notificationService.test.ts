import { strictEqual } from 'assert';
import sinon from 'sinon';
import { snykMessages } from '../../../../snyk/base/messages/snykMessages';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { NotificationService } from '../../../../snyk/common/services/notificationService';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
import { IVSCodeWindow } from '../../../../snyk/common/vscode/window';

suite('NotificationService', () => {
  let window: IVSCodeWindow;
  let commands: IVSCodeCommands;

  setup(() => {
    window = ({
      showInformationMessage: () => Promise.resolve(snykMessages.welcome.button),
    } as unknown) as IVSCodeWindow;
    commands = {
      executeCommand: sinon.fake(),
    } as IVSCodeCommands;
  });

  teardown(() => {
    sinon.restore();
  });

  test('"Welcome Button Is Clicked" analytical event is logged', async () => {
    const logWelcomeButtonIsClickedFake = sinon.fake();
    const analytics = ({
      logWelcomeButtonIsClicked: logWelcomeButtonIsClickedFake,
    } as unknown) as IAnalytics;
    const configuration = {
      shouldShowWelcomeNotification: true,
    } as IConfiguration;

    const notificationService = new NotificationService(window, commands, configuration, analytics);
    await notificationService.init((_, __) => Promise.resolve());

    strictEqual(logWelcomeButtonIsClickedFake.calledOnce, true);
  });
});
