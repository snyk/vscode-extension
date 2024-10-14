import * as vscode from 'vscode';

export interface GitExtension {
  getAPI(version: number): GitAPI;
}

export interface GitAPI {
  repositories: Repository[];
}

export interface Repository {
  rootUri: vscode.Uri;
  state: RepositoryState;
}

export interface RepositoryState {
  HEAD: Branch | undefined;
  onDidChange: vscode.Event<void>;
}

export interface Branch {
  name?: string;
}
