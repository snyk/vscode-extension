import * as vscode from 'vscode';
import { snykMessages } from '../../base/messages/snykMessages';
import { errorType } from '../../base/modules/interfaces';
import { messages as ossMessages } from '../../snykOss/messages/test';
import { configuration } from '../configuration/instance';
import { VSCODE_VIEW_OSS_VIEW_COMMAND } from '../constants/commands';
import { errorsLogs } from '../messages/errorsServerLogMessages';
import { openSnykViewContainer } from '../vscode/vscodeCommandsUtils';
import { IVSCodeWindow } from '../vscode/window';

export interface INotificationService {
  init(errorHandler: (error: errorType, options: { [key: string]: any }) => Promise<void>): Promise<void>;
  showErrorNotification(message: string): Promise<void>;
  showOssBackgroundScanNotification(newVulnerabilityCount: number): Promise<void>;
}

export class NotificationService implements INotificationService {
  constructor(private readonly window: IVSCodeWindow) {}

  async init(errorHandler: (error: errorType, options: { [key: string]: any }) => Promise<void>): Promise<void> {
    await this.checkWelcomeNotification().catch(err =>
      errorHandler(err, {
        message: errorsLogs.welcomeNotification,
      }),
    );
  }

  private async checkWelcomeNotification(): Promise<void> {
    if (!configuration.shouldShowWelcomeNotification) {
      return;
    }

    const pressedButton = await this.window.showInformationMessage(
      snykMessages.welcome.msg,
      snykMessages.welcome.button,
    );
    if (pressedButton === snykMessages.welcome.button) {
      await openSnykViewContainer();
    }

    await configuration.hideWelcomeNotification();
  }

  async showErrorNotification(message: string): Promise<void> {
    await this.window.showErrorMessage(message);
  }

  async showOssBackgroundScanNotification(newVulnerabilityCount: number): Promise<void> {
    const pressedButton = await this.window.showInformationMessage(
      ossMessages.newCriticalVulnerabilitiesFound(newVulnerabilityCount),
      ossMessages.viewResults,
      ossMessages.hide,
    );

    if (pressedButton === ossMessages.viewResults) {
      await vscode.commands.executeCommand(VSCODE_VIEW_OSS_VIEW_COMMAND);
    } else if (pressedButton === ossMessages.hide) {
      await configuration.hideOssBackgroundScanNotification();
    }
  }
}
