// Changing this requires changing display name in package.json.
export const SNYK_NAME = 'Snyk Security - Code, Open Source Dependencies, IaC Configurations';
export const SNYK_TOKEN_KEY = 'snyk.token';
export const SNYK_UNIQUE_EXTENSION_NAME = 'Snyk Vulnerability Scanner';
export const SNYK_PUBLISHER = 'snyk-security';
export const SNYK_NAME_EXTENSION = SNYK_UNIQUE_EXTENSION_NAME.toLowerCase().replace(/[()]/g, '').replace(/\s/g, '-');
export const MAX_CONNECTION_RETRIES = 5; // max number of automatic retries before showing an error
export const IDE_NAME = 'Visual Studio Code';
export const IDE_NAME_SHORT = 'vscode';
export const COMMAND_DEBOUNCE_INTERVAL = 200; // 200 milliseconds
export const DEFAULT_SCAN_DEBOUNCE_INTERVAL = 1000; // 1 second
export const DEFAULT_LS_DEBOUNCE_INTERVAL = 1000; // 1 second
export const OSS_SCAN_DEBOUNCE_INTERVAL = 10000; // 10 seconds
export const EXECUTION_THROTTLING_INTERVAL = 1000 * 10; // * 60 * 30; // 30 minutes
export const EXECUTION_PAUSE_INTERVAL = 1000 * 60 * 30; // 30 minutes
export const REFRESH_VIEW_DEBOUNCE_INTERVAL = 200; // 200 milliseconds
// If CONNECTION_ERROR_RETRY_INTERVAL is smaller than EXECUTION_DEBOUNCE_INTERVAL it might get swallowed by the debouncer
export const CONNECTION_ERROR_RETRY_INTERVAL = DEFAULT_SCAN_DEBOUNCE_INTERVAL * 2 + 1000 * 3;

export const SNYK_LEARN_API_CACHE_DURATION_IN_MS = 1000 * 60 * 60 * 24; // 1 day
