export const messages = {
  progressTitle: 'Downloading Snyk CLI...',
  startingDownload: 'Starting Snyk CLI download...',
  startingUpdate: 'Starting Snyk CLI update...',
  isLatest: 'Snyk CLI version is up-to-date.',
  notSupported: 'Snyk CLI cannot be downloaded because OS platform is not supported.',
  integrityCheckFailed: 'The downloaded Snyk CLI integrity check failed.',
  couldNotDeleteExecutable: 'Could not delete existing CLI executable.',
  downloadCanceled: 'CLI download has been canceled.',
  cliDownloadFailed: 'Failed to download or update Snyk CLI.',

  downloadFinished: (version: string): string => `Snyk CLI v${version} has been successfully downloaded.`,
  updateFinished: (version: string): string => `Snyk CLI has been updated to v${version}.`,
};
