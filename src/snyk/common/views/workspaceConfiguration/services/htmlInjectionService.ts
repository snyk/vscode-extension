import { getNonce } from '../../nonce';
import { ExecuteCommandBridge } from '../../executeCommandBridge';

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

          var _uiState = vscode.getState() || {};

          function _saveUiState(patch) {
            _uiState = Object.assign({}, vscode.getState() || {}, patch);
            vscode.setState(_uiState);
          }

          window.__saveIdeConfig__ = function(jsonString) {
            vscode.postMessage({
              type: 'saveConfig',
              config: jsonString
            });
          };

          window.__IS_IDE_AUTOSAVE_ENABLED__ = true;

          ${ExecuteCommandBridge.buildClientScript()}

          window.addEventListener('message', function (event) {
            var message = event.data;
            if (message.type === 'setAuthToken' && message.token) {
              if (typeof window.setAuthToken === 'function') {
                window.setAuthToken(message.token, message.apiUrl);
              }
            }
          });

          window.addEventListener('load', function () {
            var activeTabId = _uiState.activeTabId;
            var activeFolderIndex = _uiState.activeFolderIndex;
            var focusedFieldId = _uiState.focusedFieldId;

            if (activeTabId === 'folder-dropdown-btn' && activeFolderIndex != null) {
              var folderItem = document.querySelector('.folder-dropdown-item[data-folder-index="' + activeFolderIndex + '"]');
              if (folderItem) {
                folderItem.click();
              }
            } else if (activeTabId) {
              var tabEl = document.getElementById(activeTabId);
              if (tabEl && !tabEl.classList.contains('active')) {
                tabEl.click();
              }
            }

            if (focusedFieldId) {
              var fieldEl = document.getElementById(focusedFieldId);
              if (fieldEl) {
                fieldEl.focus();
              }
            }

            document.addEventListener('click', function (e) {
              var target = e.target;
              while (target && target !== document) {
                if (target.classList && target.classList.contains('folder-dropdown-item') && target.hasAttribute('data-folder-index')) {
                  _saveUiState({ activeTabId: 'folder-dropdown-btn', activeFolderIndex: target.getAttribute('data-folder-index') });
                  return;
                }
                if (target.classList && target.classList.contains('nav-link') && target.hasAttribute('data-tab-target')) {
                  _saveUiState({ activeTabId: target.id, activeFolderIndex: null });
                  return;
                }
                target = target.parentElement;
              }
            });

            document.addEventListener('focusin', function (e) {
              if (e.target && e.target.id) {
                _saveUiState({ focusedFieldId: e.target.id });
              }
            });
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
