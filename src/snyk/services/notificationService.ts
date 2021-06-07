import { configuration } from '../configuration';
import { TELEMETRY_EVENTS } from '../constants/telemetry';
import { snykMessages } from '../messages/snykMessages';
import * as vscode from 'vscode';
import { openSnykViewContainer } from '../utils/vscodeCommandsUtils';
import { errorType } from '../../interfaces/SnykInterfaces';
import { errorsLogs } from '../messages/errorsServerLogMessages';

export class NotificationService {
  static async init(
    eventProcessor: (event: string) => Promise<void>,
    errorHandler: (error: errorType, options: { [key: string]: any }) => Promise<void>,
  ): Promise<void> {
    await this.checkWelcomeNotification(eventProcessor).catch(err =>
      errorHandler(err, {
        message: errorsLogs.welcomeNotification,
      }),
    );
  }

  static async checkWelcomeNotification(eventProcessor: (event: string) => Promise<void>): Promise<void> {
    if (!configuration.shouldShowWelcomeNotification) {
      return;
    }

    eventProcessor(TELEMETRY_EVENTS.viewWelcomeNotification);
    const pressedButton = await vscode.window.showInformationMessage(
      snykMessages.welcome.msg,
      snykMessages.welcome.button,
    );
    if (pressedButton === snykMessages.welcome.button) {
      await openSnykViewContainer();
    }
    await configuration.hideWelcomeNotification();
  }
}
