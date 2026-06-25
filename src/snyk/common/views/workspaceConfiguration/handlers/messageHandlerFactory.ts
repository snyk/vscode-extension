import { ILog } from '../../../logger/interfaces';
import { IVSCodeCommands } from '../../../vscode/commands';
import { IVSCodeWindow } from '../../../vscode/window';
import { hasPropertyOfType, hasOptionalPropertyOfType } from '../../../tsUtil';
import { WebviewMessage, ConfirmationDialogMessage } from '../types/workspaceConfiguration.types';
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
    private readonly window: IVSCodeWindow,
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
        case 'confirmationDialog':
          return await this.handleConfirmationDialog(message);
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error handling message from workspace configuration webview');
    }
  }

  /**
   * Shows a native modal confirmation dialog and returns the boolean result tagged with the
   * webview callbackId, so the provider can post it back via the shared messageResult path.
   * Cancel / dismiss returns false (fail-closed), matching snyk-ls's ideBridge.confirm contract.
   */
  private async handleConfirmationDialog(
    message: ConfirmationDialogMessage,
  ): Promise<{ callbackId: string; result: boolean } | void> {
    // All field validation lives here (not isWebviewMessage) so that any confirmationDialog
    // carrying a usable callbackId always resolves — a message rejected upstream would strand
    // the client's pending callback and hang snyk-ls's confirm.

    // A well-formed callbackId is required to resolve the webview callback at all. Without one
    // there is nothing safe to reply to, so forged/foreign messages are dropped (our client
    // always sends a valid id).
    if (typeof message.callbackId !== 'string' || !ExecuteCommandBridge.isValidCallbackId(message.callbackId)) {
      this.logger.warn('Received confirmationDialog message with missing or invalid callbackId - ignoring');
      return;
    }

    // From here we always resolve the callback (fail-closed to false) so snyk-ls's confirm never
    // hangs and the client's pending callback entry is freed — including when the message text is
    // missing or not a string.
    if (typeof message.message !== 'string' || !message.message) {
      this.logger.warn('Received confirmationDialog message without valid message text - cancelling');
      return { callbackId: message.callbackId, result: false };
    }

    try {
      // message text is shown verbatim in a native OS-level modal. It originates from our own
      // snyk-ls config HTML (trusted, CSP-nonce'd) — same trust boundary as executeCommand. If
      // that HTML were ever compromised this would surface attacker-controlled modal text.
      const choice = await this.window.showInformationMessage(message.message, { modal: true }, 'Yes');
      return { callbackId: message.callbackId, result: choice === 'Yes' };
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error showing confirmation dialog');
      return { callbackId: message.callbackId, result: false };
    }
  }

  private isWebviewMessage(message: unknown): message is WebviewMessage {
    if (!hasPropertyOfType(message, 'type', 'string')) return false;
    const { type } = message as { type: string };

    if (type === 'saveConfig') {
      return hasOptionalPropertyOfType(message, 'config', 'string');
    }

    // Field validation is deferred to handleConfirmationDialog so it can fail-closed-reply
    // (resolving the client callback) rather than rejecting here and stranding it.
    if (type === 'confirmationDialog') {
      return true;
    }

    return type === 'executeCommand';
  }
}
