import { getNonce } from '../../nonce';

export interface IHtmlInjectionService {
  injectIdeScripts(html: string): string;
}

export class HtmlInjectionService implements IHtmlInjectionService {
  injectIdeScripts(html: string): string {
    const nonce = getNonce();

    const scopeStyles = `
      <style nonce="${nonce}">
        :root {
          --text-color: var(--vscode-foreground);
          --background-color: var(--vscode-editor-background);
          --section-background-color: var(--vscode-sideBar-background);
          --border-color: var(--vscode-panel-border);
          --focus-color: var(--vscode-focusBorder);
          --link-color: var(--vscode-textLink-foreground);
          --input-background-color: var(--vscode-input-background);
          --default-font: var(--vscode-font-family);
        }
        .scope-indicator {
          font-style: italic;
          opacity: 0.6;
          font-size: 0.9em;
          margin-left: 4px;
        }
      </style>
    `;

    const ideScript = `
      <script nonce="${nonce}">
        (function() {
          const vscode = acquireVsCodeApi();

          window.__saveIdeConfig__ = function(jsonString) {
            vscode.postMessage({
              type: 'saveConfig',
              config: jsonString
            });
          };

          window.__IS_IDE_AUTOSAVE_ENABLED__ = true;

          window.__ideCallbacks__ = {};
          let __ideCallbackCounter = 0;

          window.__ideExecuteCommand__ = function(cmd, args, callback) {
            let callbackId = null;
            if (typeof callback === 'function') {
              callbackId = '__cb_' + (++__ideCallbackCounter);
              window.__ideCallbacks__[callbackId] = callback;
            }
            vscode.postMessage({
              type: 'executeCommand',
              command: cmd,
              arguments: args,
              callbackId: callbackId,
            });
          };

          // Listen for messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'setAuthToken' && message.token) {
              window.setAuthToken(message.token);
            }
            if (message.type === 'commandResult' && message.callbackId) {
              const cb = window.__ideCallbacks__[message.callbackId];
              if (typeof cb === 'function') {
                delete window.__ideCallbacks__[message.callbackId];
                cb(message.result);
              }
            }
          });
        })();
      </script>
    `;

    // Replace nonce-ideNonce placeholder with actual nonce (if HTML from LS uses this pattern)
    html = html.replace(/ideNonce/g, `${nonce}`);

    // Inject styles before closing head tag
    html = html.replace('</head>', `${scopeStyles}</head>`);

    // Inject scripts before closing body tag
    return html.replace('</body>', `${ideScript}</body>`);
  }
}
