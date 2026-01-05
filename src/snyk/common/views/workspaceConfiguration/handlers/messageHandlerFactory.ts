// ABOUTME: Factory for creating appropriate message handlers based on message type
// ABOUTME: Validates and routes webview messages to the correct handler
import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/configurationPersistenceService';
import { SNYK_INITIATE_LOGIN_COMMAND, SNYK_INITIATE_LOGOUT_COMMAND } from '../../../constants/commands';

export interface IMessageHandlerFactory {
  handleMessage(message: unknown): Promise<void>;
}

export class MessageHandlerFactory implements IMessageHandlerFactory {
  constructor(
    private readonly commandExecutor: IVSCodeCommands,
    private readonly configPersistenceService: IConfigurationPersistenceService,
    private readonly logger: ILog,
  ) {}

  async handleMessage(message: unknown): Promise<void> {
    try {
      if (!this.isWebviewMessage(message)) {
        this.logger.warn('Received invalid message from workspace configuration webview');
        return;
      }

      switch (message.type) {
        case 'saveConfig':
          if (!message.config) {
            this.logger.warn('Received invalid configuration from workspace configuration webview');
            return;
          }
          await this.configPersistenceService.handleSaveConfig(message.config);
          break;
        case 'login':
          this.logger.info('Triggering login from workspace configuration');
          await this.commandExecutor.executeCommand(SNYK_INITIATE_LOGIN_COMMAND);
          break;
        case 'logout':
          this.logger.info('Triggering logout from workspace configuration');
          await this.commandExecutor.executeCommand(SNYK_INITIATE_LOGOUT_COMMAND);
          break;
        default:
          this.logger.warn(`Unknown message type from workspace configuration webview: ${message.type}`);
      }
    } catch (e) {
      this.logger.error(`Error handling message from workspace configuration webview: ${e}`);
    }
  }

  private isWebviewMessage(message: unknown): message is WebviewMessage {
    return hasPropertyOfType(message, 'type', 'string') && hasOptionalPropertyOfType(message, 'config', 'string');
  }
}
