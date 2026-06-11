// ABOUTME: Type definitions for workspace configuration data structures

/** Minimal shape for the JSON blob the HTML settings form posts via `saveConfig`. */
export interface HtmlSettingsData extends Record<string, unknown> {
  isFallbackForm?: boolean;
  token?: string;
  folderConfigs?: HtmlFolderSettingsData[];
}

/** Folder-level settings from the HTML form. Only `folderPath` is accessed by name. */
export interface HtmlFolderSettingsData extends Record<string, unknown> {
  folderPath: string;
}

export interface IWorkspaceConfigurationWebviewProvider {
  showPanel(): Promise<void>;
  disposePanel(): void;
  setAuthToken(token: string, apiUrl?: string): void;
  // Pushes inbound per-folder config to an open settings webview so it reflects folder-scoped
  // changes made elsewhere (e.g. tree-view toolbar filter/delta toggles). Field-agnostic: forwards
  // the whole folderConfigs payload; the LS-served page decides what to apply. No-op if not open.
  applyInboundFolderConfig(folderConfigs: unknown): void;
}

export interface SaveConfigMessage {
  type: 'saveConfig';
  config?: string;
}

export interface ExecuteCommandMessage {
  type: 'executeCommand';
  command?: string;
  arguments?: unknown[];
  callbackId?: string;
}

export type WebviewMessage = SaveConfigMessage | ExecuteCommandMessage;
