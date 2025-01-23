/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  type SummaryMessage = {
    type: 'sendSummaryParams';
    args: {
      summary: Summary;
    };
  };

  type Summary = {
    toggleDelta: boolean;
  };
  const vscode = acquireVsCodeApi();

  function sendMessage(message: SummaryMessage) {
    vscode.postMessage(message);
  }

  document.getElementById('totalIssues')?.addEventListener('click', () => {
    toggleDelta(false);
  });
  document.getElementById('newIssues')!.addEventListener('click', () => {
    toggleDelta(true);
  });

  function toggleDelta(toggle: boolean) {
    const summary: Summary = {
      toggleDelta: toggle,
    };

    const message: SummaryMessage = {
      type: 'sendSummaryParams',
      args: { summary },
    };
    sendMessage(message);
  }
})();
