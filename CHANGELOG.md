# Snyk Security Changelog

## [2.19.2]
- Update download endpoint to downloads.snyk.io.
- Send correct FixId to AI Fix endpoint.
- Hide AI Fix div if no fixes found.

## [2.19.1]
- Adjust OSS panel font size.

## [2.19.0]
- Moved delta scan preview setting to settings page.
- New error message in UI when net new scan is done on an invalid repository. Net new scans only work on Git.
- Clear in Memory cache when branch is changed.
- Added Clear Persisted Cache command.
- Add support for ai fix feedback analytic when pressing apply on a fix.

## [2.18.2]
- Update Language Server Protocol version to 15.

## [2.18.0]
- Added base branch selection for IaC and OSS

## [2.17.0]
- render IaC via Language Server

## [2.16.3]
- fix readability of `code` elements within the **overview** section when using high-contrast themes (both dark and light). Text color now matches the background.

## [2.16.2]
- updated the language server protocol version to 14 to support new communication model.

## [2.16.1]
- updated the language server protocol version to 13 to support delta findings.
- added setting for choosing authentication method
- renamed vulnerabilities to issues
- only display DeepCode AI fix tree node when issues were found

## [2.16.0]
- Reorganize settings page into categorized sections:
  - General Settings
  - Product Selection
  - Severity Selection
  - Project Settings
  - Executable Settings
  - User Experience
  - Advanced

## [2.15.0]
- Sync with LS to retrieve and persist folderConfigs changes.
- Add command to select the base branch.

## [2.14.0]
- Add UI components for selecting a base branch for delta findings for Code and Code Quality behind a feature flag.

### [2.13.1]
- Refactor the Suggestion Panel for OSS so it's more secure and will be supported in other IDEs

## [2.13.0]
- Fix `.suggestion` class to ensure it is scrollable and not overlapped by the `.suggestion-actions` fixed element. This change prevents the suggestion content from being hidden.
- transmit required protocol version to language server
- Remove unused stylesheet and refactor stylesheets

## [2.12.3]
- Fix a bug in AI Applyfix on Windows.
- Changes some of the colours used in the HTML panel so it's consistent with designs.

## [2.12.2]
- Refactors the feature flag logic into its own service.
- Fix multi-file links in the DataFlow HTML panel.

## [2.12.1]
- Fix applying AI fixes on Windows.
- Add CSS rules for `.light-only` and `.dark-only` to the LSP implementation. This allows the LSP to apply different styles based on the current theme.
- Update to LS protocol version 12.

## [2.12.0]
- Fix Code Suggestion rendering issue on Windows.
- Renders the AI Fix panel and adds more custom styling for VSCode.
- Adds position line interaction.

## [2.11.0]
- Add warning messages in the Tree View for the issue view options used in consistent ignores.
- Add Data Flow and Ignore Footer intractions for Consistent Ignores flows.
- Fix endpoint computation based on custom endpoint.
- Remove snyk/codeclient dependancy.

## [2.10.0]
- Injects custom styling for the HTML panel used by Snyk Code for consistent ignores.

## [2.9.0]
- Lower the strictness of custom endpoint regex validation so that single tenant APIs are allowed.

## [2.8.0]
- Add the Issue View Options panel to the Snyk Security Settings.

## [2.7.0]
- Fetch Snyk Consistent Ignores feature flag from the Language Server
- Conditionally render Code details panel from Language Server

## [2.6.1]
- Improve the validation of the custom endpoint and change the default to https://api.snyk.io.

## [2.6.0]
- Improve UX of AI fixes by adding previews and options

## [2.4.1]
- updated the language server protocol version to 11 to support global ignores

## [2.4.0]
- Added the [ Ignored ] text if the finding should be marked as ignored.

## [2.3.10]
### Added
- Added the [ Ignored ] text if the finding should be marked as ignored.

## [2.3.9]
### Fixes
- do not restrict activation of extension (auto-scan on startup)

## [2.3.8]

### Fixes
- fix: shortened plugin name to just Snyk Security

## [2.3.6]

### Changes
- Removed Amplitude telemetry and corresponding setting from VSCode

## [2.3.5]

### Documentation

- Updated the `README.md` file to correct and improve the links to the Visual Studio Code extension documentation.

## [2.3.4]

### Fixes

- Changing the custom endpoints has an effect on whether we sent Amplitude events or not

## [2.3.3]

### Fixed

- Snyk Code: Added `isExampleLineEncoded` boolean flag to `CommitChangeLine` type to prevent re-encoding strings in the UI of the example code blocks.

## [2.3.2]

### Fixed

- Only send Amplitude events when connected to a MT US environment

## [2.2.1]

### Fixed

- Snyk Code: Optimized performance by caching DOM element references in `suggestion-details`. This minimizes repetitive DOM queries, enhancing the responsiveness and efficiency of the webview.
- Snyk Code: Corrected the visibility toggling behavior in the `#suggestion-details` section. Replaced inline styling with CSS class-based approach.

## [2.2.0]

### Added

- Snyk Code: New UI section `#suggestion-details` for displaying suggestion details in snykCode.
- Snyk Code: Added a collapsible section for suggestion details. This includes a 'Read more' button to toggle the full display of suggestion details.

## [2.1.0]

### Added

- Snyk LS: Snyk Open Source Security features now use Language Server backend
- Snyk OSS: Squiggly warning underlines for direct and transitive vulnerabilities
- Snyk OSS: Squiggly underlines colour coded based on severity
- Snyk OSS: Vulnerability count text includes transitive vulnerabilities
- Snyk OSS: Vulnerability count text includes breakdown of vulnerabilities by severity
- Snyk OSS: Hovers lists vulnerabilities and shows summary (without typo)
- Snyk OSS: Hovers show information from security.snyk.io/vuln database
- Snyk OSS: CodeActions shows actions available for all vulnerabilities

## [1.26.1]

### Fixed

- Expanded the server settings returned by `LanguageClientMiddleware` to include necessary attributes for consistent initialization across the application.

### Added

- Introduced the `defaultToTrue` utility function within `LanguageServerSettings` to treat undefined feature flags as enabled by default.

### Changed

- Enhanced the `ServerSettings` type to include user-specific attributes such as `integrationName`, `integrationVersion`, `automaticAuthentication`, and `deviceId`. This unification simplifies the configuration management.

### BREAKING CHANGES

- The `fromConfiguration` method in `LanguageServerSettings` now requires a `User` object to initialize server settings, impacting all areas of the application where server settings are consumed.
- `LanguageClientMiddleware` instantiation now requires a `User` object, aligning with new server settings structure. Consumers must now pass a `User` object upon middleware creation.

## [1.25.1]

### Changed

- Improved UI: updated issue details panels, used vscode colors where possible, new meta section for Code
- Optimized messages in the UI

## [1.24.1]

### Fixed

- Removed false positives feature flag
- View management: show accurate information during startup of the plugin

## [1.23.1]

### Fixed

- Vulnerabilities in transitive dependencies

## [1.23.0]

- add `language-server` as first positional argument to language server start
- enable setting of log level in language server via SNYK_LOG_LEVEL
- enable setting of debug level in language server via `-d` or `--debug`

## [1.22.0]

### Added

- Only check `snykgov.io` domain to check if fedramp

## [1.21.5]

### Added

- Fedrammp endpoints will not send Sentry/Amplitude events

## [1.21.4]

### Changed

- Use Language Server to retrieve vulnerability count for HTML files

## [1.21.1]

### Fixed

- Snyk Learn links

## [1.21.0]

### Fixed

- Plugin Initialization

## [1.20.3]

### Removed

- Cleaned up unused code.

## [1.19.1]

### Fixed

- Updated support links.

## [1.18.3]

### Added

- Added support for OAuth2 authentication
- Snyk Learn: now uses language server to retrieve lessons

## [1.18.3]

### Added

- Enabled Autofix for Snyk Code issues.

## [1.18.0]

### Added

- Snyk IaC: Added details panel body.
- Snyk IaC: Added code action to navigate from issue in editor to issue details panel.
- Snyk IaC: Remove UI feature flag.

## [1.17.0]

### Added

- Snyk IaC: Added tree view.
- Snyk IaC: Added IaC issue data type definitions.
- Snyk IaC: UI Feature flag.

## [1.15.5]

### Changed

- Enabled dynamic Snyk Code scans via Language Server rollout.

## [1.15.3]

### Changed

- Extension uses Language Server to run Snyk Code scans.

## [1.15.2]

### Fixed

- Reduce load on Snyk Code API.

## [1.15.1]

### Fixed

- Force Language Server redownload when LSP version increases.

## [1.15.0]

### Changed

- Snyk Code "Advanced" menu replaced with a settings option called "Scanning Mode".

## [1.14.0]

### Added

- Snyk Code results using Language Server in tree view and details panel.

### Fixed

- File ignores for Snyk Code.

### Fixed

- ignore untrusted CAs if strict proxy is disabled

### Added

- Enabling Snyk Code scans using Language Server under a feature flag.

## [1.13.0]

### Fixed

- ignore untrusted CAs if strict proxy is disabled

### Added

- Enabling Snyk Code scans using Language Server under a feature flag.

## [1.12.3]

### Fixed

- Trust workspace folders if parent dir is trusted.
- Snyk LS: updated protocol version.
- Contact and documentation url.

### Changed

- Removed background notification about found vulnerabilities in Snyk Open Source.

## [1.12.2]

### Fixed

- Regression introduced in 1.7.6.

## [1.11.0]

### Changed

- Infrastructure as Code scans via Snyk Language Server without a feature flag.

## [1.10.0]

### Added

- Snyk LS: Passing severity filter settings to LS on initialisation.

### Fixed

- Extension crashes when Code disabled and severity filter changed.

## [1.9.0]

### Added

- Added workspace trust feature.

## [1.8.0]

### Added

- Snyk LS: (Preview) Added IaC scans enabled by feature flag (`lsIacScan`).

## [1.7.7]

### Fixed

- `Error: Channel has been closed` exception.

## [1.7.6]

### Fixed

- `http:proxyStrictSSL` option always respected.
- Language client respects proxy protocol when proxy is used.

## [1.7.4]

### Fixed

- "The language client requires VS Code version ^1.67.0 but received version 1.x.y" error.

## [1.7.2]

### Fixed

- "Language client is not ready yet when handling" error.

## [1.7.0]

### Changed

- Snyk LS: Remove feature flag for authentication using Language Server.

## [1.6.0]

### Added

- Snyk LS: Configure custom Language Server binary path in settings.
- Snyk LS: Deprecate snyk.logout command.
- Snyk LS: Automatically download and update language server binary

### Fixed

-- Performance issues on some machines due to outdated dependency.

## [1.5.0]

### Added

- Snyk LS: Deprecate copyAuthLink command.

## [1.4.0]

### Added

- Snyk LS: Handling of hasAuthenticated notification from LS
- Snyk LS: Setting keys translation for language server.
- Snyk-LS: Transmit Snyk Token to language server on manually entering it.

## [1.3.0]

### Added

- Snyk LS: Integrated language server - it's deactivated by default
- Snyk LS: Adds functionality for setting a path to a custom LS binary

## [1.2.24]

### Fixed

- Snyk Code: patch for failing when analysis bundle gets expired after its validity period.

## [1.2.22]

### Added

- Analytics around Open Source scan notification.

### Fixed

- Snyk Code: failing when analysis bundle gets expired after its validity period.

## [1.2.21]

### Added

- Setting to disable extension's automatic dependency management (i.e. Snyk CLI updates).
- Setting to provide path to Snyk CLI executable.
- Analytics around Snyk Code scanning modes.

## [1.2.20]

### Fixed

- Snyk Code: properly render/restore panel on refresh.

## [1.2.19]

### Added

- Support for multi-tenant Snyk deployments.

### Changed

- Updated severity icons

### Fixed

- Snyk Code: don't show example fixes if there are none.
- Snyk Code: prevent fix examples panel from crashing in rare cases.
- Opening extension settings.

## [1.2.18]

### Added

- Base64 encoding for Snyk Code analysis file content payloads.
- Links to privacy policy and terms of service.

### Changed

- Anonymize user IDs before reporting to Sentry.

## [1.2.17]

### Fixed

- "Set Token" command reporting "Cannot read properties of undefined" error.

## [1.2.16]

### Fixed

- "Error: Cannot get password" appearing during retrieval of the token from secret
  storage.
- Cached Snyk Learn links being opened when clicking on "Learn about this vulnerability".
- Snyk Code inter-file issues linking only to the main file where issue occurs.

## [1.2.15]

### Added

- Snyk Code: add support for Single Tenant setups
- Update organization setting description to clarify expected value.
- Snyk Open Source: vulnerability count is shown in NPM `devDependencies` when `--dev` flag is passed to Snyk CLI via additional arguments.
- Vulnerability detail views now have links to Snyk Learn when we have an appropriate lesson available.

## [1.2.13]

### Fixed

- Reported Snyk Code diagnostics not respecting `snyk.features.codeSecurity`, `snyk.features.codeQuality` and `snyk.severity` settings.
- Reported diagnostics not opening files from Problems view, when operating in workspace mode with whitespace in paths to workspace folders.

## [1.2.12]

### Added

- Command to set API token manually together with a placeholder setting for users to find the command.

## [1.2.11]

### Fixed

- "Error: Unable to write to User Settings because snyk.token is not a registered configuration." appearing during token migration to secret storage.

## [1.2.10]

### Added

- Encryption for when storing the Snyk token after successful login.
- Surface request ID when Snyk Code analysis fail in the output channel.

### Changed

- Extension name to "Security - Code and Open Source Dependencies".

### Fixed

- "Illegal argument: character must be non-negative" error upon receiving Snyk
  Code analysis.

### Removed

- The token text field from the extension configuration and will not be visible anymore.

## [1.2.9]

### Added

- Check Snyk Code enablement using configured organization from settings.
- Prevent Snyk Code Local Code Engine users from uploading the code to Snyk servers.

### Changed

- Increase navigation button sizes in Snyk Code example fixes.
- Analysis duration removed from the results tree.

### Fixed

- Do not present the user with error view when token is invalid.
- Proxy environments handling.
- Transient error handling for Snyk Code.

## [1.2.8]

### Fixed

- Automatic scanning not working for Windows environments.
- Failing Open Source Security scan for .NET projects.
- Snyk Code suggestion view being blank periodically when opening an issue.

## [1.2.7]

### Added

- Automatic crash reporting for caught and uncaught errors.
- Analytics for vulnerability count hovers.
- Preview feature toggles.

### Changed

- Extension feedback link.

### Fixed

- Authentication flow for users whose routers cannot resolve IPv6 address.

## [1.2.6]

### Fixed

- Correct user identification in analytics.

## [1.2.5]

### Fixed

- Authentication flow for users who have IPv6 address.
- Snyk Code issues not always opening up from the issue tree.

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
