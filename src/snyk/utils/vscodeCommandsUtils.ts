import * as vscode from 'vscode';
import { SNYK_NAME } from '../constants/general';
import {
  VSCODE_VIEW_CONTAINER_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
  SNYK_CONTEXT_PREFIX,
  SNYK_OPEN_BROWSER_COMMAND,
} from '../constants/commands';
import { createDCIgnore } from './ignoreFileUtils';

export const openSnykSettingsCommand = async (): Promise<void> => {
  await vscode.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, SNYK_NAME);
};

export const openSnykViewContainer = async (): Promise<void> => {
  await vscode.commands.executeCommand(VSCODE_VIEW_CONTAINER_COMMAND);
};

export const setContext = async (key: string, value: unknown): Promise<void> => {
  await vscode.commands.executeCommand('setContext', `${SNYK_CONTEXT_PREFIX}${key}`, value);
};

export const viewInBrowser = async (url: string): Promise<void> => {
  await vscode.commands.executeCommand(SNYK_OPEN_BROWSER_COMMAND, url);
};

export const createDCIgnoreCommand = async (custom = false, path?: string): Promise<void> => {
  if (!path) {
    const paths = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
    for (const p of paths) {
      await createDCIgnore(p, custom);
    }
  } else {
    await createDCIgnore(path, custom);
  }
};
