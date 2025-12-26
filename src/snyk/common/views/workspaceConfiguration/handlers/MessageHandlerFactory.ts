// ABOUTME: Factory for creating appropriate message handlers based on message type
// ABOUTME: Validates and routes webview messages to the correct handler
import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/ConfigurationPersistenceService';
import { SaveConfigHandler } from './SaveConfigHandler';
import { LoginHandler } from './LoginHandler';
import { LogoutHandler } from './LogoutHandler';

export interface IMessageHandler {
  handle(message: WebviewMessage): Promise<void>;
}

export interface IMessageHandlerFactory {
  handleMessage(message: unknown): Promise<void>;
}

export class MessageHandlerFactory implements IMessageHandlerFactory {
  private readonly saveConfigHandler: SaveConfigHandler;
  private readonly loginHandler: LoginHandler;
  private readonly logoutHandler: LogoutHandler;

  constructor(
    private readonly commandExecutor: IVSCodeCommands,
    configPersistenceService: IConfigurationPersistenceService,
    private readonly logger: ILog,
  ) {
    this.saveConfigHandler = new SaveConfigHandler(configPersistenceService, logger);
    this.loginHandler = new LoginHandler(commandExecutor, logger);
    this.logoutHandler = new LogoutHandler(commandExecutor, logger);
  }

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
          await this.saveConfigHandler.handle(message);
          break;
        case 'login':
          await this.loginHandler.handle(message);
          break;
        case 'logout':
          await this.logoutHandler.handle(message);
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
