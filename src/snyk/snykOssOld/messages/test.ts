export const messages = {
  testFailed: 'Open Source Security test failed.',
  testStarted: 'Open Source Security test started.',
  viewResults: 'View results',
  hide: "Don't show again",

  testFailedForPath: (path: string): string => `Open Source Security test failed for "${path}".`,
  testFinished: (projectName: string): string => `Open Source Security test finished for "${projectName}".`,
};
