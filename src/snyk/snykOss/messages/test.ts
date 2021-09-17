export const messages = {
  testFailed: 'Open Source Security test failed.',
  testStarted: 'Open Source Security test started.',
  testFinished: 'Open Source Security test finished.',
  viewResults: 'View results',
  hide: "Don't show again",

  newCriticalVulnerabilitiesFound: (count: number): string =>
    `We found ${count} new critical OSS ${count == 1 ? 'vulnerability' : 'vulnerabilities'}`,
};
