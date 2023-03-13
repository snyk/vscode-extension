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

    // // Fill identifiers line
    // fillIdentifiers();

    // // Fill summary
    // fillSummary();

    // // Fill detailed paths
    // fillDetailedPaths();

    // // Fill overview
    // fillOverview();

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
})();
