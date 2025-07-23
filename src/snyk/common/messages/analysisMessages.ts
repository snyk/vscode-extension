export const messages = {
  scanFailed: 'Scan failed',
  noWorkspaceTrust: 'No workspace folder was granted trust',
  clickToProblem: 'Click here to see the problem.',
  scanRunning: 'Scanning...',
  congratsNoIssuesFound: '✅ Congrats! No issues found!',
  congratsNoOpenIssuesFound: '✅ Congrats! No open issues found!',
  openIssuesAreDisabled: 'Open issues are disabled!',
  noIgnoredIssues: '✋ No ignored issues, open issues are disabled',
  openAndIgnoredIssuesAreDisabled: 'Open and Ignored issues are disabled!',
  noFixableIssues: 'There are no issues fixable by Snyk Agent Fix.',
  allSeverityFiltersDisabled: 'Please enable severity filters to see the results.',
  allIssueViewOptionsDisabled: 'Adjust your settings to view Open or Ignored issues.',
  openIssueViewOptionDisabled: 'Adjust your settings to view Open issues.',
  ignoredIssueViewOptionDisabled: 'Adjust your settings to view Ignored issues.',
  duration: (time: string, day: string): string => `Analysis finished at ${time}, ${day}`,
  noWorkspaceTrustDescription:
    'None of workspace folders were trusted. If you trust the workspace, you can add it to the list of trusted folders in the extension settings, or when prompted by the extension next time.',
};
