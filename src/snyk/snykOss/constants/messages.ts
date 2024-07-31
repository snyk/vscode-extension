export const messages = {
  analysis: {
    scanFailed: 'Scan failed',
    noWorkspaceTrust: 'No workspace folder was granted trust',
    clickToProblem: 'Click here to see the problem.',
    scanRunning: 'Scanning...',
    allSeverityFiltersDisabled: 'Please enable severity filters to see the results.',
    duration: (time: string, day: string): string => `Analysis finished at ${time}, ${day}`,
    noWorkspaceTrustDescription:
      'None of workspace folders were trusted. If you trust the workspace, you can add it to the list of trusted folders in the extension settings, or when prompted by the extension next time.',
  },
  errors: {
    suggestionViewShowFailed: 'Failed to show Snyk OSS suggestion view',
  },
  test: {
    testFailed: 'Open Source Security test failed.',
    testStarted: 'Open Source Security test started.',
    viewResults: 'View results',
    hide: "Don't show again",
    testFailedForPath: (path: string): string => `Open Source Security test failed for "${path}".`,
    testFinished: (projectName: string): string => `Open Source Security test finished for "${projectName}".`,
  },
  treeView: {
    cookingDependencies: 'Scanning...',
    runTest: 'Run scan for Open Source security issues.',
    noVulnerabilitiesFound: ' ✅ Congrats! No issues found!',
    issue: 'issue',
    issues: 'issues',
    singleVulnerabilityFound: 'Snyk found 1 issue',
    multipleVulnerabilitiesFound: (issueCount: number): string => `Snyk found ${issueCount} issues`,
  },
};
