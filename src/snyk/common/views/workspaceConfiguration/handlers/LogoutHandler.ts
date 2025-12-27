// ABOUTME: Handler for logout action from webview
// ABOUTME: Triggers Snyk logout command via command executor
import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { SNYK_INITIATE_LOGOUT_COMMAND } from '../../../constants/commands';
import { WebviewMessage } from '../types/workspaceConfiguration.types';
import { IMessageHandler } from './MessageHandlerFactory';

export class LogoutHandler implements IMessageHandler {
  constructor(private readonly commandExecutor: IVSCodeCommands, private readonly logger: ILog) {}

  async handle(_message: WebviewMessage): Promise<void> {
    this.logger.info('Triggering logout from workspace configuration');
    await this.commandExecutor.executeCommand(SNYK_INITIATE_LOGOUT_COMMAND);
  }
}
