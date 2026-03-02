import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/configurationPersistenceService';

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
        case 'executeCommand':
          if (!message.command) {
            this.logger.warn('Received executeCommand message without command from workspace configuration webview');
            return;
          }
          await this.commandExecutor.executeCommand(message.command, ...(message.arguments ?? []));
          break;
        default:
          this.logger.warn(`Unknown message type from workspace configuration webview: ${message.type}`);
      }
    } catch (e) {
      this.logger.error(`Error handling message from workspace configuration webview: ${e}`);
    }
  }

  private isWebviewMessage(message: unknown): message is WebviewMessage {
    return (
      hasPropertyOfType(message, 'type', 'string') &&
      hasOptionalPropertyOfType(message, 'config', 'string') &&
      hasOptionalPropertyOfType(message, 'command', 'string')
    );
  }
}
