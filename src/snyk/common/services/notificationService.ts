import { snykMessages } from '../../base/messages/snykMessages';
import { messages as ossMessages } from '../../snykOss/messages/test';
import { IAnalytics } from '../analytics/itly';
import { IConfiguration } from '../configuration/configuration';
import { VSCODE_VIEW_CONTAINER_COMMAND, VSCODE_VIEW_OSS_VIEW_COMMAND } from '../constants/commands';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { errorsLogs } from '../messages/errors';
import { IVSCodeCommands } from '../vscode/commands';
import { IVSCodeWindow } from '../vscode/window';

export interface INotificationService {
  init(): Promise<void>;
  showErrorNotification(message: string): Promise<void>;
  showOssBackgroundScanNotification(newVulnerabilityCount: number): Promise<void>;
}

export class NotificationService implements INotificationService {
  constructor(
    private readonly window: IVSCodeWindow,
    private readonly commands: IVSCodeCommands,
    private readonly configuration: IConfiguration,
    private readonly analytics: IAnalytics,
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
      this.analytics.logWelcomeButtonIsClicked();
    }

    await this.configuration.hideWelcomeNotification();
  }

  async showErrorNotification(message: string): Promise<void> {
    await this.window.showErrorMessage(message);
  }

  async showOssBackgroundScanNotification(newVulnerabilityCount: number): Promise<void> {
    const notification = this.window.showInformationMessage(
      ossMessages.newCriticalVulnerabilitiesFound(newVulnerabilityCount),
      ossMessages.viewResults,
      ossMessages.hide,
    );

    this.analytics.logBackgroundAnalysisNotificationIsDisplayed({
      analysisType: 'Snyk Open Source',
    });

    const pressedButton = await notification;

    if (pressedButton === ossMessages.viewResults) {
      this.analytics.logBackgroundAnalysisNotificationButtonIsClicked({
        type: 'View results',
      });
      await this.commands.executeCommand(VSCODE_VIEW_OSS_VIEW_COMMAND);
    } else if (pressedButton === ossMessages.hide) {
      this.analytics.logBackgroundAnalysisNotificationButtonIsClicked({
        type: 'Don’t show again',
      });
      await this.configuration.hideOssBackgroundScanNotification();
    }
  }
}
