import * as vscode from 'vscode';
import { errorType } from '../../interfaces/SnykInterfaces';
import { configuration } from '../configuration';
import { errorsLogs } from '../messages/errorsServerLogMessages';
import { snykMessages } from '../messages/snykMessages';
import { openSnykViewContainer } from '../utils/vscodeCommandsUtils';

export class NotificationService {
  static async init(errorHandler: (error: errorType, options: { [key: string]: any }) => Promise<void>): Promise<void> {
    await NotificationService.checkWelcomeNotification().catch(err =>
      errorHandler(err, {
        message: errorsLogs.welcomeNotification,
      }),
    );
  }

  static async checkWelcomeNotification(): Promise<void> {
    if (!configuration.shouldShowWelcomeNotification) {
      return;
    }

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
