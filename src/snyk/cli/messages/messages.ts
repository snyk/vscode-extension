// TODO: Cleanup
export const messages = {
  progressTitle: 'Downloading Snyk dependencies...',
  startingDownload: 'Starting Snyk dependencies download...',
  startingUpdate: 'Starting Snyk dependencies update...',
  isLatest: 'Snyk dependencies are up-to-date.',
  notSupported: 'Snyk CLI (dependency of this extension) cannot be downloaded because OS platform is not supported.',
  integrityCheckFailed: 'The downloaded Snyk CLI (dependency of this extension) integrity check failed.',
  couldNotDeleteExecutable: 'Could not delete existing Snyk CLI (dependency of this extension) executable.',
  downloadCanceled: 'Download of Snyk dependencies has been canceled.',
  lsDownloadFailed: 'Failed to download or update Snyk dependencies.',

  downloadFinished: (version: string): string =>
    `Snyk dependencies (CLI v${version}) have been successfully downloaded.`,
  updateFinished: (version: string): string => `Snyk dependencies have been updated (CLI to v${version}).`,
};
