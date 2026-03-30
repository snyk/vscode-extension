# Snyk Security Changelog

Please see https://github.com/snyk/vscode-extension/releases for a detailed changelog.

## Unreleased

- Synthesize per-folder org rows from workspace folders for outbound LSP config when LS has not yet sent `$/snyk.folderConfigs`, so `workspace/didChangeConfiguration` includes non-empty `folderConfigs` after workspace settings changes.
- When `snyk.advanced.cliReleaseChannel` changes, stop the language server and re-run CLI download only if automatic dependency management is enabled (manual CLI installs are unaffected).
