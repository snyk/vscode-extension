// ABOUTME: Handler for saving configuration from webview
// ABOUTME: Delegates to ConfigurationPersistenceService for actual persistence logic
import { ILog } from '../../../logger/interfaces';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/ConfigurationPersistenceService';
import { IMessageHandler } from './MessageHandlerFactory';

export class SaveConfigHandler implements IMessageHandler {
  constructor(
    private readonly configPersistenceService: IConfigurationPersistenceService,
    private readonly logger: ILog,
  ) {}

  async handle(message: WebviewMessage): Promise<void> {
    if (!message.config) {
      this.logger.warn('SaveConfigHandler received message without config');
      return;
    }

    await this.configPersistenceService.handleSaveConfig(message.config);
  }
}
