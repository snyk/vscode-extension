export const ERRORS = {
  DOWNLOAD_FAILED: `Unable to download Snyk CLI

The Snyk extension for Visual Studio Code could not download the required CLI version from the configured release channel. This may be due to one of the following reasons:

1. Network connectivity issues
2. Misconfigured release channel settings
3. Temporary unavailability of the requested CLI version

To resolve this issue:

1. Check your internet connection and proxy settings
2. Verify the release channel configuration in the extension settings
3. Try switching to a different CLI release channel (e.g., from "stable" to "preview")
4. Restart Visual Studio Code and attempt to reinstall the extension
5. If the problem persists, check for any known issues or updates on the Snyk GitHub repository`,
};
