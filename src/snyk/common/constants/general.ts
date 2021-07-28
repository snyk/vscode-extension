// Changing this requires changing display name in package.json.
export const SNYK_NAME = 'Snyk Vulnerability Scanner';
export const SNYK_NAME_EXTENSION = SNYK_NAME.toLowerCase().replaceAll(' ', '-');
export const MAX_CONNECTION_RETRIES = 5; // max number of automatic retries before showing an error
export const IDE_NAME = 'vscode';
export const COMMAND_DEBOUNCE_INTERVAL = 200; // 200 milliseconds
export const EXECUTION_DEBOUNCE_INTERVAL = 1000; // 1 second
export const EXECUTION_THROTTLING_INTERVAL = 1000 * 10; // * 60 * 30; // 30 minutes
export const EXECUTION_PAUSE_INTERVAL = 1000 * 60 * 30; // 30 minutes
export const REFRESH_VIEW_DEBOUNCE_INTERVAL = 200; // 200 milliseconds
// If CONNECTION_ERROR_RETRY_INTERVAL is smaller than EXECUTION_DEBOUNCE_INTERVAL it might get swallowed by the debouncer
export const CONNECTION_ERROR_RETRY_INTERVAL = EXECUTION_DEBOUNCE_INTERVAL * 2 + 1000 * 3;
