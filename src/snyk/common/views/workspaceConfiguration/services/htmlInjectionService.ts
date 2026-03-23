import { getNonce } from '../../nonce';
import { ExecuteCommandBridge } from '../../executeCommandBridge';
import { INBOUND_LSP_CONFIGURATION_MESSAGE } from '../constants';

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
        .snyk-lsp-setting-meta {
          display: block;
          font-size: 0.85em;
          opacity: 0.75;
          margin-top: 2px;
          margin-bottom: 4px;
        }
        .snyk-lsp-locked {
          opacity: 0.85;
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

          ${ExecuteCommandBridge.buildClientScript()}

          /**
           * Applies \`$/snyk.configuration\` merged view to the DOM.
           * Convention: global controls use \`data-snyk-setting-key="<pflag>"\` outside any
           * \`[data-snyk-folder-path]\` section; per-folder controls live under an ancestor
           * with \`data-snyk-folder-path="<absolute path>"\`.
           */
          function resetInboundLspConfigurationUi() {
            document.querySelectorAll('[data-snyk-lsp-meta="1"]').forEach(function (n) {
              n.remove();
            });
            document.querySelectorAll('[data-snyk-setting-key]').forEach(function (el) {
              el.classList.remove('snyk-lsp-locked');
              if ('disabled' in el) {
                el.disabled = false;
              }
              el.removeAttribute('aria-readonly');
            });
          }

          function applySettingToControl(el, setting) {
            if (!setting) {
              return;
            }
            if (setting.isLocked === true) {
              el.classList.add('snyk-lsp-locked');
              if ('disabled' in el) {
                el.disabled = true;
              }
              el.setAttribute('aria-readonly', 'true');
            }
            var source = setting.source;
            var originScope = setting.originScope;
            if (source || originScope) {
              var meta = document.createElement('span');
              meta.setAttribute('data-snyk-lsp-meta', '1');
              meta.className = 'snyk-lsp-setting-meta';
              var parts = [];
              if (source) {
                parts.push('source: ' + source);
              }
              if (originScope) {
                parts.push('origin: ' + originScope);
              }
              meta.textContent = parts.join(' · ');
              var parent = el.parentNode;
              if (parent) {
                parent.insertBefore(meta, el.nextSibling);
              }
            }
          }

          function applyInboundLspConfiguration(view) {
            if (!view) {
              return;
            }
            resetInboundLspConfigurationUi();
            var globalSettings = view.globalSettings || {};
            var globalKeys = Object.keys(globalSettings);
            for (var gi = 0; gi < globalKeys.length; gi++) {
              var gk = globalKeys[gi];
              var gSetting = globalSettings[gk];
              var gNodes = document.querySelectorAll('[data-snyk-setting-key]');
              for (var j = 0; j < gNodes.length; j++) {
                var gel = gNodes[j];
                if (gel.getAttribute('data-snyk-setting-key') !== gk) {
                  continue;
                }
                if (gel.closest('[data-snyk-folder-path]')) {
                  continue;
                }
                applySettingToControl(gel, gSetting);
              }
            }
            var folderMap = view.folderSettingsByPath || {};
            var folderPaths = Object.keys(folderMap);
            for (var fi = 0; fi < folderPaths.length; fi++) {
              var folderPath = folderPaths[fi];
              var folderSettings = folderMap[folderPath] || {};
              var fKeys = Object.keys(folderSettings);
              var sections = document.querySelectorAll('[data-snyk-folder-path]');
              for (var si = 0; si < sections.length; si++) {
                var sec = sections[si];
                if (sec.getAttribute('data-snyk-folder-path') !== folderPath) {
                  continue;
                }
                for (var fk = 0; fk < fKeys.length; fk++) {
                  var fkName = fKeys[fk];
                  var fSetting = folderSettings[fkName];
                  var controls = [];
                  if (sec.matches && sec.matches('[data-snyk-setting-key]') && sec.getAttribute('data-snyk-setting-key') === fkName) {
                    controls.push(sec);
                  }
                  sec.querySelectorAll('[data-snyk-setting-key]').forEach(function (cel) {
                    if (cel.getAttribute('data-snyk-setting-key') === fkName) {
                      controls.push(cel);
                    }
                  });
                  for (var ci = 0; ci < controls.length; ci++) {
                    applySettingToControl(controls[ci], fSetting);
                  }
                }
              }
            }
          }

          window.__applyInboundLspConfiguration__ = applyInboundLspConfiguration;

          window.addEventListener('message', function (event) {
            var message = event.data;
            if (message.type === 'setAuthToken' && message.token) {
              if (typeof window.setAuthToken === 'function') {
                window.setAuthToken(message.token, message.apiUrl);
              }
            }
            if (message.type === '${INBOUND_LSP_CONFIGURATION_MESSAGE}' && message.view) {
              applyInboundLspConfiguration(message.view);
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
