export const messages = {
  suggestionViewShowFailed: 'Failed to show Snyk Code suggestion view',
  reportFalsePositiveViewShowFailed: 'Failed to show Snyk Code report false positive view',
  reportFalsePositiveFailed: 'Failed to report false positive.',

  suggestionViewMessageHandlingFailed: (msg: string): string =>
    `Failed to handle message from Snyk Code suggestion view ${msg}`,
};
