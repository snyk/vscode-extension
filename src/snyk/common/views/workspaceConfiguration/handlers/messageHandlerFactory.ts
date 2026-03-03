import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/configurationPersistenceService';
import { ErrorHandler } from '../../../error/errorHandler';
import { ExecuteCommandBridge } from '../../executeCommandBridge';

export interface IMessageHandlerFactory {
  handleMessage(message: unknown): Promise<{ callbackId: string; result: unknown } | void>;
}

export class MessageHandlerFactory implements IMessageHandlerFactory {
  private readonly executeCommandBridge: ExecuteCommandBridge;

  constructor(
    commandExecutor: IVSCodeCommands,
    private readonly configPersistenceService: IConfigurationPersistenceService,
    private readonly logger: ILog,
  ) {
    this.executeCommandBridge = new ExecuteCommandBridge(commandExecutor, logger);
  }

  async handleMessage(message: unknown): Promise<{ callbackId: string; result: unknown } | void> {
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
          return await this.executeCommandBridge.handleMessage(message);
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

    return type === 'executeCommand';
  }
}
