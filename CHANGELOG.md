# Snyk Security Changelog

Please see https://github.com/snyk/vscode-extension/releases for a detailed changelog.

## Unreleased

- Outbound LSP `folderConfigs` use `configuration.getFolderConfigs()` when non-empty; otherwise synthesize per-folder rows from workspace folders when the workspace has folders. Remove the `ReceivedFolderConfigsFromLs` gate, `$/snyk.folderConfigs` notification registration, and `SNYK_FOLDERCONFIG` constant.
- When `snyk.advanced.cliReleaseChannel` changes, stop the language server and re-run CLI download only if automatic dependency management is enabled (manual CLI installs are unaffected).
