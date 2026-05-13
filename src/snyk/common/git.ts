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

interface RepositoryState {
  HEAD: Branch | undefined;
  onDidChange: vscode.Event<void>;
}

interface Branch {
  name?: string;
}
