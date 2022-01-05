# Snyk Vulnerability Scanner Changelog

## [1.2.5]

### Fixed

- Authentication flow for users who have IPv6 address.
- Snyk Code issues not opening up from the issue tree.

## [1.2.4]

### Added

- Use user environment settings when spawning Snyk CLI as a child process.

### Fixed

- Snyk Code 'Show this suggestion' quick fix not opening the view from an editor.
- Snyk Code suggestion view not displaying when navigating multiple times to the same issue.

## [1.2.3]

### Changed

- Use standard VS Code buttons for ignoring Snyk Code suggestions in webview.
- Improved network outage tolerance for Snyk Code requests.
- Feedback link updated.

### Added

- Surface vulnerability count from OSS scan in editor for JavaScript and TypeScript files.
- Surface vulnerability count from OSS scan in editor for package.json for NPM projects.
- Surface imported modules as part of `<script>` element in editor for HTML files.
- Retry CLI download when CLI is not installed correctly and scan is requested.
- Show CLI download failure within the Open Source Security tree view.
- Ability to run A/B experiments using Amplitude Experiment.

### Removed

- Commit comments as part of Snyk Code suggestion view.

## [1.2.1]

### Fixed

- Wrong casing for the emitted JS file that break extension on Linux and Windows machines.

## [1.2.0]

### Added

- Snyk Open Source product support using Snyk CLI.
- Support of the latest Snyk Code API.
- Additional analytical events for issue hover and quick fix contributions.

### Fixed

- Relative Snyk Code bundle file path resolution on Linux systems that leads to extension crashing.

### Removed

- Feedback form for Snyk Code suggestions.

## [1.1.3]

### Changed

- Provide feedback around Snyk's technical issues impacting Snyk Code.

## [1.1.2]

### Changed

- Disabled feedback form temporarily.
- Implemented support for new Snyk Code API.

## [1.1.1]

### Fixed

- Missing capture for "Issue Is Viewed" for Snyk Code quality issues.

## [1.1.0]

### Added

- Introduced split between security and quality issues in Snyk Code.
- Ability to copy auth link to clipboard buffer during the authentication process.

### Fixed

- Authentication for IPv6 users.
- Authentication timeout increased.
- Navigation to extension settings.
- Running extension in remote development environment.
- Marketplace links in readme.

### Changed

- Removed "snyk.codeEnabled' setting as of no need.
- Updated “Help” tree view links.
- Visual amends to settings view.
