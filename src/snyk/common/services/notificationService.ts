import { snykMessages } from '../../base/messages/snykMessages';
import { IConfiguration } from '../configuration/configuration';
import { VSCODE_VIEW_CONTAINER_COMMAND } from '../constants/commands';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { errorsLogs } from '../messages/errors';
import { IVSCodeCommands } from '../vscode/commands';
import { IVSCodeWindow } from '../vscode/window';

export interface INotificationService {
  init(): Promise<void>;
  showErrorNotification(message: string): Promise<void>;
}

export class NotificationService implements INotificationService {
  constructor(
    private readonly window: IVSCodeWindow,
    private readonly commands: IVSCodeCommands,
    private readonly configuration: IConfiguration,
    private readonly logger: ILog,
  ) {}

  async init(): Promise<void> {
    await this.checkWelcomeNotification().catch(err =>
      ErrorHandler.handle(err, this.logger, errorsLogs.welcomeNotification),
    );
  }

  private async checkWelcomeNotification(): Promise<void> {
    if (!this.configuration.shouldShowWelcomeNotification) {
      return;
    }

    const pressedButton = await this.window.showInformationMessage(
      snykMessages.welcome.msg,
      snykMessages.welcome.button,
    );

    if (pressedButton === snykMessages.welcome.button) {
      await this.commands.executeCommand(VSCODE_VIEW_CONTAINER_COMMAND);
    }

    await this.configuration.hideWelcomeNotification();
  }

  async showErrorNotification(message: string): Promise<void> {
    await this.window.showErrorMessage(message);
  }
}
