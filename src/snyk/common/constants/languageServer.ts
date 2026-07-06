// Language Server constants
// Language Server name, used e.g. for the output channel
export const SNYK_LANGUAGE_SERVER_NAME = 'Snyk Language Server';
// The internal language server protocol version for custom messages and configuration
export const PROTOCOL_VERSION = 25;
// Sentinel reported by locally-built (non-release) snyk-ls binaries via `--protocolVersion`.
// snyk-ls treats this as always-compatible (see application/server/server.go handleProtocolVersion),
// so the IDE must too — otherwise local development binaries can never start.
export const DEVELOPMENT_PROTOCOL_VERSION = 'development';

// LS protocol methods (needed for not having to rely on vscode dependencies in testing)
export const DID_CHANGE_CONFIGURATION_METHOD = 'workspace/didChangeConfiguration';

// custom methods
export const SNYK_HAS_AUTHENTICATED = '$/snyk.hasAuthenticated';
export const SNYK_ADD_TRUSTED_FOLDERS = '$/snyk.addTrustedFolders';
export const SNYK_SCAN = '$/snyk.scan';
export const SNYK_SCANSUMMARY = '$/snyk.scanSummary';
export const SNYK_REGISTER_MCP = '$/snyk.registerMcp';
export const SNYK_TREEVIEW = '$/snyk.treeView';
export const SNYK_CONFIGURATION = '$/snyk.configuration';
