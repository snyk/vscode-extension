export const messages = {
  cookingDependencies: 'Getting ready Snyk dependencies...',

  runTest: 'Run scan for Open Source security vulnerabilities.',
  testRunning: 'Scanning project for vulnerabilities...',
  noVulnerabilitiesFound: 'Snyk found no vulnerabilities ✅',
  singleVulnerabilityFound: 'Snyk found 1 vulnerability',
  vulnerability: 'vulnerability',
  vulnerabilities: 'vulnerabilities',

  multipleVulnerabilitiesFound: (issueCount: number): string => `Snyk found ${issueCount} vulnerabilities`,
};
