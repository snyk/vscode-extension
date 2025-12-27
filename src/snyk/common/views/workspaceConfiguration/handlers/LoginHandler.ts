// ABOUTME: Handler for login action from webview
// ABOUTME: Triggers Snyk login command via command executor
import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { SNYK_INITIATE_LOGIN_COMMAND } from '../../../constants/commands';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IMessageHandler } from './MessageHandlerFactory';

export class LoginHandler implements IMessageHandler {
  constructor(private readonly commandExecutor: IVSCodeCommands, private readonly logger: ILog) {}

  async handle(_message: WebviewMessage): Promise<void> {
    this.logger.info('Triggering login from workspace configuration');
    await this.commandExecutor.executeCommand(SNYK_INITIATE_LOGIN_COMMAND);
  }
}
