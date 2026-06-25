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

/** Only commands in the snyk.* namespace may be invoked from a webview. */
const ALLOWED_COMMAND_PREFIX = 'snyk.';

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
  constructor(private readonly commandExecutor: IVSCodeCommands, private readonly logger: ILog) {}

  /**
   * Returns the client-side JavaScript that defines window.__ideExecuteCommand__ in a webview.
   * Assumes a variable named `vscode` (from acquireVsCodeApi()) is already in scope.
   * Safe to embed inside any IIFE that has acquired the VS Code API.
   *
   * Why callbackId?
   * VS Code's webview postMessage API is a one-way fire-and-forget channel on both sides —
   * there is no native request/response primitive (MessagePort is not available in webviews).
   * To match an async messageResult reply to the specific call that triggered it (especially
   * when multiple calls may be in-flight concurrently), each call is tagged with a unique
   * callbackId. The pending callback is stored in __ideCallbacks__ under that id and invoked
   * once the matching reply arrives, turning two one-way messages into a logical call/response.
   * The messageResult envelope is generic — used by every bridge function that registers a
   * callback (__ideExecuteCommand__, __ideConfirmationDialog__), not just commands. The tree-view
   * webview reuses the same envelope name on its own independent channel (keyed on requestId);
   * the shared name is a convention, not a shared resolver.
   */
  static buildClientScript(): string {
    return `
      window.__ideCallbacks__ = {};
      let __ideCallbackCounter = 0;

      // Register a callback for an async webview<->host round-trip; returns its id
      // (or null for fire-and-forget calls with no callback). postMessage cannot carry
      // functions, so the callback stays here keyed by id; the host replies with
      // { type:'messageResult', callbackId, result } and __ideResolveCallback__ invokes it.
      // Shared by every bridge function (__ideExecuteCommand__, __ideConfirmationDialog__)
      // so the call/response protocol stays in one place. The '__cb_' + counter format
      // must match the server-side validator ExecuteCommandBridge.isValidCallbackId.
      window.__ideRegisterCallback__ = function(callback) {
        if (typeof callback !== 'function') return null;
        const callbackId = '__cb_' + (++__ideCallbackCounter);
        window.__ideCallbacks__[callbackId] = callback;
        return callbackId;
      };

      // Resolve and invoke a pending callback by id (one-shot).
      window.__ideResolveCallback__ = function(callbackId, result) {
        const cb = window.__ideCallbacks__[callbackId];
        if (typeof cb === 'function') {
          delete window.__ideCallbacks__[callbackId];
          cb(result);
        }
      };

      window.__ideExecuteCommand__ = function(cmd, args, callback) {
        const callbackId = window.__ideRegisterCallback__(callback);
        vscode.postMessage({ type: 'executeCommand', command: cmd, arguments: args, callbackId: callbackId });
      };

      window.addEventListener('message', function(event) {
        const message = event.data;
        if (message.type === 'messageResult' && message.callbackId) {
          window.__ideResolveCallback__(message.callbackId, message.result);
        }
      });
    `;
  }

  /**
   * Handles an incoming webview message. If it is an executeCommand message, dispatches it to
   * VS Code and returns { callbackId, result } so the caller can post messageResult back to the
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

      const msg = message;
      if (!msg.command) {
        this.logger.warn('Received executeCommand message without command');
        return;
      }

      if (!msg.command.startsWith(ALLOWED_COMMAND_PREFIX)) {
        this.logger.warn(`Webview attempted to execute disallowed command: ${msg.command}`);
        return;
      }

      const result = await this.commandExecutor.executeCommand(msg.command, ...(msg.arguments ?? []));

      if (msg.callbackId) {
        if (!ExecuteCommandBridge.isValidCallbackId(msg.callbackId)) {
          this.logger.warn('Received executeCommand message with invalid callbackId - ignoring callback');
          return;
        }
        return { callbackId: msg.callbackId, result };
      }
    } catch (e) {
      ErrorHandler.handle(e, this.logger, 'Error handling executeCommand message');
    }
  }

  /**
   * Validates the callbackId wire format shared by all webview bridge functions.
   * Must match the '__cb_' + counter format produced by __ideRegisterCallback__ in buildClientScript().
   * Static + public so other message handlers (e.g. MessageHandlerFactory) validate against one source.
   */
  static isValidCallbackId(callbackId: string): boolean {
    return /^__cb_\d+$/.test(callbackId);
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
