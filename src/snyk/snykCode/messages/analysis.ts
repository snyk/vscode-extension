export const messages = {
  started: 'Code analysis started.',
  finished: 'Code analysis finished.',
  temporaryFailed: 'Snyk Code is temporarily unavailable.',
  retry: 'We are automatically retrying to connect...',

  failed: (requestId: string): string => `Code analysis failed. Request ID: ${requestId}`,
};
