import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IConfigurationPersistenceService } from '../services/configurationPersistenceService';
import { ErrorHandler } from '../../../error/errorHandler';
import { ExecuteCommandBridge } from '../../executeCommandBridge';
import { IConfiguration } from '../../../configuration/configuration';
import { AUTH_METHOD_OAUTH, AUTH_METHOD_PAT, AUTH_METHOD_TOKEN } from '../../../constants/settings';
import { AuthenticationService } from '../../../../base/services/authenticationService';

export interface IMessageHandlerFactory {
  handleMessage(message: unknown): Promise<{ callbackId: string; result: unknown } | void>;
}

export class MessageHandlerFactory implements IMessageHandlerFactory {
  private readonly executeCommandBridge: ExecuteCommandBridge;

  constructor(
    commandExecutor: IVSCodeCommands,
    private readonly configPersistenceService: IConfigurationPersistenceService,
    private readonly logger: ILog,
    private readonly configuration?: IConfiguration,
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
        case 'executeCommand': {
          const msg = message as { command?: string; arguments?: unknown[] };
          if (
            msg.command === 'snyk.login' &&
            this.configuration &&
            Array.isArray(msg.arguments) &&
            msg.arguments.length >= 3
          ) {
            await this.saveLoginArgs(
              msg.arguments[0] as string,
              msg.arguments[1] as string,
              msg.arguments[2] as boolean,
            );
          }
          return await this.executeCommandBridge.handleMessage(message);
        }
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error handling message from workspace configuration webview');
    }
  }

  private async saveLoginArgs(authMethod: string, endpoint: string, insecure: boolean): Promise<void> {
    const methodMap: Record<string, string> = {
      oauth: AUTH_METHOD_OAUTH,
      pat: AUTH_METHOD_PAT,
      token: AUTH_METHOD_TOKEN,
    };
    const vsCodeMethod = methodMap[authMethod] ?? AUTH_METHOD_OAUTH;
    await this.configuration!.setAuthenticationMethod(vsCodeMethod);

    if (endpoint) {
      AuthenticationService.setAuthFlowUpdatingEndpoint(true);
      try {
        await this.configuration!.setEndpoint(endpoint);
      } finally {
        AuthenticationService.setAuthFlowUpdatingEndpoint(false);
      }
    }

    await this.configuration!.setInsecure(insecure);
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
