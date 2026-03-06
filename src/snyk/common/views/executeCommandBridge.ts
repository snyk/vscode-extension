import { ILog } from '../logger/interfaces';
import { IVSCodeCommands } from '../vscode/commands';
import { hasOptionalPropertyOfType, hasProperty, hasPropertyOfType } from '../tsUtil';
import { ErrorHandler } from '../error/errorHandler';

interface ExecuteCommandMessage {
  type: 'executeCommand';
  command?: string;
  arguments?: unknown[];
  callbackId?: string;
}

/**
 * Shared bridge for the window.__ideExecuteCommand__ JS↔IDE contract.
 * Usable by any HTML webview panel (settings, tree view, etc.).
 *
 * Responsibilities:
 * - Provide the client-side JS that defines window.__ideExecuteCommand__ for injection into any webview.
 * - Dispatch incoming executeCommand messages to VS Code commands on the extension side.
 * - Return results to the JS callback via window.__ideCallbacks__.
 */
export class ExecuteCommandBridge {
  constructor(
    private readonly commandExecutor: IVSCodeCommands,
    private readonly logger: ILog,
  ) {}

  /**
   * Returns the client-side JavaScript that defines window.__ideExecuteCommand__ in a webview.
   * Assumes a variable named `vscode` (from acquireVsCodeApi()) is already in scope.
   * Safe to embed inside any IIFE that has acquired the VS Code API.
   */
  static buildClientScript(): string {
    return `
      window.__ideCallbacks__ = {};
      let __ideCallbackCounter = 0;
      window.__ideExecuteCommand__ = function(cmd, args, callback) {
        let callbackId = null;
        if (typeof callback === 'function') {
          callbackId = '__cb_' + (++__ideCallbackCounter);
          window.__ideCallbacks__[callbackId] = callback;
        }
        vscode.postMessage({ type: 'executeCommand', command: cmd, arguments: args, callbackId: callbackId });
      };
      window.addEventListener('message', function(event) {
        const message = event.data;
        if (message.type === 'commandResult' && message.callbackId) {
          const cb = window.__ideCallbacks__[message.callbackId];
          if (typeof cb === 'function') {
            delete window.__ideCallbacks__[message.callbackId];
            cb(message.result);
          }
        }
      });
    `;
  }

  /**
   * Handles an incoming webview message. If it is an executeCommand message, dispatches it to
   * VS Code and returns { callbackId, result } so the caller can post commandResult back to the
   * webview. Returns void for any other message type.
   */
  async handleMessage(message: unknown): Promise<{ callbackId: string; result: unknown } | void> {
    try {
      if (!hasPropertyOfType(message, 'type', 'string')) return;
      if ((message as { type: string }).type !== 'executeCommand') return;

      if (!this.isValidExecuteCommandMessage(message)) {
        this.logger.warn('Received invalid executeCommand message');
        return;
      }

      const msg = message as ExecuteCommandMessage;
      if (!msg.command) {
        this.logger.warn('Received executeCommand message without command');
        return;
      }

      const result = await this.commandExecutor.executeCommand(
        msg.command,
        ...(msg.arguments ?? []),
      );

      if (msg.callbackId) {
        return { callbackId: msg.callbackId, result };
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error handling executeCommand message');
    }
  }

  private isValidExecuteCommandMessage(message: unknown): message is ExecuteCommandMessage {
    return (
      hasOptionalPropertyOfType(message, 'command', 'string') &&
      (!hasProperty(message, 'arguments') ||
        (message as { arguments: unknown }).arguments === undefined ||
        Array.isArray((message as { arguments: unknown }).arguments))
    );
  }
}
