export const messages = {
  cookingDependencies: 'Scanning...',

  runTest: 'Run scan for Open Source security vulnerabilities.',
  noVulnerabilitiesFound: ' ✅ Congrats! Snyk found no vulnerabilities.',
  singleVulnerabilityFound: 'Snyk found 1 vulnerability',
  vulnerability: 'vulnerability',
  vulnerabilities: 'vulnerabilities',

  multipleVulnerabilitiesFound: (issueCount: number): string => `Snyk found ${issueCount} vulnerabilities`,
};
