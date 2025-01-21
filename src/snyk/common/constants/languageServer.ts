// Language Server constants
// Language Server name, used e.g. for the output channel
export const SNYK_LANGUAGE_SERVER_NAME = 'Snyk Language Server';
// The internal language server protocol version for custom messages and configuration
export const PROTOCOL_VERSION = 18;

// LS protocol methods (needed for not having to rely on vscode dependencies in testing)
export const DID_CHANGE_CONFIGURATION_METHOD = 'workspace/didChangeConfiguration';

// custom methods
export const SNYK_HAS_AUTHENTICATED = '$/snyk.hasAuthenticated';
export const SNYK_ADD_TRUSTED_FOLDERS = '$/snyk.addTrustedFolders';
export const SNYK_SCAN = '$/snyk.scan';
export const SNYK_FOLDERCONFIG = '$/snyk.folderConfigs';
export const SNYK_SCANSUMMARY = '$/snyk.scanSummary';
