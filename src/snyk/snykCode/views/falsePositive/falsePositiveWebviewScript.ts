/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // TODO: Redefine types until bundling is introduced into extension
  // https://stackoverflow.com/a/56938089/1713082
  type FalsePositiveWebviewModel = {
    falsePositive: {
      content: string;
    };
    title: string;
    severity: number;
    severityText: string;
    suggestionType: 'Issue' | 'Vulnerability';
    cwe: string[];
    isSecurityTypeIssue: boolean;
  };

  const vscode = acquireVsCodeApi();
  let model = {} as FalsePositiveWebviewModel;

  function send() {
    const editor = document.querySelector('.editor') as HTMLTextAreaElement;

    vscode.postMessage({
      type: 'send',
      value: {
        falsePositive: model.falsePositive,
        content: editor.value,
        isSecurityTypeIssue: model.isSecurityTypeIssue,
        issueSeverity: model.severity,
      },
    });
  }

  function navigateToUrl(url: string) {
    vscode.postMessage({
      type: 'openBrowser',
      value: url,
    });
  }

  function close() {
    vscode.postMessage({
      type: 'close',
    });
  }

  function showFalsePositive() {
    const severity = document.querySelector('.severity')!;
    const title = document.querySelector('.suggestion .suggestion-text')!;

    // Set title
    title.innerHTML = model.title;

    // Set severity icon
    setSeverityIcon();

    // Fill identifiers line
    fillIdentifiers();

    // Set editor code
    setEditorCode();

    function setSeverityIcon() {
      if (model.severityText) {
        severity.querySelectorAll('img').forEach(n => {
          if (n.id.slice(-1) === 'l') {
            if (n.id.includes(model.severityText)) n.className = 'icon light-only';
            else n.className = 'icon light-only hidden';
          } else {
            if (n.id.includes(model.severityText)) n.className = 'icon dark-only';
            else n.className = 'icon dark-only hidden';
          }
        });
      } else {
        severity.querySelectorAll('img').forEach(n => (n.className = 'icon hidden'));
      }
    }

    function fillIdentifiers() {
      const identifiers = document.querySelector('.identifiers')!;
      identifiers.innerHTML = ''; // reset node

      const type = model.suggestionType;
      const typeNode = document.createTextNode(type);
      identifiers.appendChild(typeNode);

      model.cwe.forEach(cwe => appendIdentifierSpan(identifiers, cwe, getCweLink(cwe)));
    }

    function appendIdentifierSpan(identifiers: Element, id: string, link?: string) {
      const delimiter = document.createElement('span');
      delimiter.innerText = ' | ';
      delimiter.className = 'delimiter';
      identifiers.appendChild(delimiter);

      let cveNode: HTMLElement;
      if (link) {
        cveNode = document.createElement('a');
        cveNode.onclick = () => navigateToUrl(link);
      } else {
        cveNode = document.createElement('span');
      }

      cveNode.innerText = id;

      identifiers.appendChild(cveNode);
    }

    function getCweLink(cwe: string) {
      const id = cwe.toUpperCase().replace('CWE-', '');
      return `https://cwe.mitre.org/data/definitions/${id}.html`;
    }

    function setEditorCode() {
      const editor = document.querySelector('.editor')!;
      editor.textContent = model.falsePositive.content;
    }
  }

  document.getElementById('cancel')?.addEventListener('click', close);
  document.getElementById('send')?.addEventListener('click', send);

  // deepcode ignore InsufficientValidation: Content Security Policy applied in provider
  window.addEventListener('message', event => {
    const { type, args } = event.data;
    switch (type) {
      case 'set': {
        model = args;
        vscode.setState(model);
        break;
      }
      case 'get': {
        model = vscode.getState();
        break;
      }
    }

    showFalsePositive();
  });
})();
