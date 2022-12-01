export const messages = {
  scanFailed: 'Scan failed',
  noWorkspaceTrust: 'No workspace folder was granted trust',
  clickToProblem: 'Click here to see the problem.',
  allSeverityFiltersDisabled: 'Please enable severity filters to see the results.',
  duration: (time: string, day: string): string => `Analysis finished at ${time}, ${day}`,
  noWorkspaceTrustDescription:
    'None of workspace folders were trusted. If you trust the workspace, you can add it to the list of trusted folders in the extension settings, or when prompted by the extension next time.',
};
