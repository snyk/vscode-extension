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
  type ConfigurationIssue = {
    id: string;
    title: string;
    severity: string;
    filePath: string;
    additionalData: IacIssueData;
  };
  type IacIssueData = {
    publicId: string;
    documentation: string;
    lineNumber: number;
    issue: string;
    impact: string;
    path?: string[];
    resolve?: string;
    references?: string[];
  };

  let issue = {} as ConfigurationIssue;

  const vscode = acquireVsCodeApi();

  function navigateToUrl(url: string) {
    vscode.postMessage({
      type: 'openBrowser',
      value: url,
    });
  }

  function showCurrentSuggestion() {
    const severity = document.querySelector('.severity')!;
    const title = document.querySelector('.suggestion .suggestion-text')!;

    // Set title
    title.innerHTML = issue.title;

    // Set severity icon
    setSeverityIcon();

    // Fill identifiers line
    fillIdentifiers();

    // Fill description
    fillDescription();

    // Fill impact
    fillImpact();

    // Fill path
    fillPath();

    // Fill remediation
    fillRemediation();

    // Fill references
    fillReferences();

    function setSeverityIcon() {
      if (issue.severity) {
        severity.querySelectorAll('img').forEach(n => {
          if (n.id.slice(-1) === 'l') {
            if (n.id.includes(issue.severity)) n.className = 'icon light-only';
            else n.className = 'icon light-only hidden';
          } else {
            if (n.id.includes(issue.severity)) n.className = 'icon dark-only';
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
      const typeNode = document.createTextNode('Issue');
      identifiers.appendChild(typeNode);

      appendIdentifierSpan(
        identifiers,
        issue.additionalData.publicId.toUpperCase(),
        issue.additionalData.documentation,
      );
    }

    function fillDescription() {
      const module = document.querySelector('.description > .content')!;
      module.textContent = issue.additionalData.issue;
    }

    function fillImpact() {
      const module = document.querySelector('.impact > .content')!;
      module.textContent = issue.additionalData.impact;
    }

    function fillPath() {
      const module = document.querySelector('.path > .content code')!;
      if (issue.additionalData.path) {
        module.textContent = issue.additionalData.path.join(' > ');
      } else {
        module.textContent = 'No path available.';
      }
    }

    function fillRemediation() {
      const module = document.querySelector('.remediation')!;
      if (issue.additionalData.resolve) {
        module.textContent = issue.additionalData.resolve;
      } else {
        module.textContent = 'No remediation available.';
      }
    }

    function fillReferences() {
      const section = document.querySelector('.references')!;
      if (issue.additionalData.references) {
        section.classList.remove('hidden');
        const module = document.querySelector('.references > .reference-links')!;
        for (const reference of issue.additionalData.references) {
          const paragraph = document.createElement('p');
          const referenceLink = document.createElement('a');
          const linkText = document.createTextNode(reference);
          referenceLink.appendChild(linkText);
          referenceLink.title = reference;
          referenceLink.href = reference;
          paragraph.appendChild(referenceLink);
          module.appendChild(paragraph);
        }
      }
    }
  }

  window.addEventListener('message', event => {
    const { type, args } = event.data;
    switch (type) {
      case 'set': {
        issue = args;
        vscode.setState({ ...vscode.getState(), issue });
        showCurrentSuggestion();
        break;
      }
      case 'get': {
        issue = vscode.getState()?.issue || {};
        showCurrentSuggestion();
        break;
      }
    }
  });

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
})();
