/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/// <reference lib="dom" />

declare const acquireVsCodeApi: any;

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  document.querySelector('.analyze-button')?.addEventListener('click', () => {
    saveProductSelection();
  });

  function saveProductSelection() {
    vscode.postMessage({
      type: 'featuresSelected',
      value: {
        codeSecurityEnabled: (document.getElementById('codeSecurityEnabled') as HTMLInputElement)?.checked,
        codeQualityEnabled: (document.getElementById('codeQualityEnabled') as HTMLInputElement)?.checked,
      },
    });
  }
})();
