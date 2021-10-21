export const messages = {
  scanFailed: 'Scan failed',
  clickToProblem: 'Click here to see the problem.',
  allSeverityFiltersDisabled: 'Please enable severity filters to see the results.',
  duration: (sDuration: number, time: string, day: string): string =>
    `Analysis took ${sDuration}s, finished at ${time}, ${day}`,
};
