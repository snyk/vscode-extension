import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasProperty, hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/configurationPersistenceService';
import { ErrorHandler } from '../../../error/errorHandler';

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
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error handling message from workspace configuration webview');
    }
  }

  private isWebviewMessage(message: unknown): message is WebviewMessage {
    if (!hasPropertyOfType(message, 'type', 'string')) return false;
    const { type } = message as { type: string };

    if (type === 'saveConfig') {
      return hasOptionalPropertyOfType(message, 'config', 'string');
    }

    if (type === 'executeCommand') {
      return (
        hasOptionalPropertyOfType(message, 'command', 'string') &&
        (!hasProperty(message, 'arguments') ||
          (message as { arguments: unknown }).arguments === undefined ||
          Array.isArray((message as { arguments: unknown }).arguments))
      );
    }

    return false;
  }
}
