import * as vscode from 'vscode';
import { VSCODE_VIEW_CONTAINER_COMMAND, SNYK_CONTEXT_PREFIX } from '../constants/commands';

export const openSnykViewContainer = async (): Promise<void> => {
  await vscode.commands.executeCommand(VSCODE_VIEW_CONTAINER_COMMAND);
};

export const setContext = async (key: string, value: unknown): Promise<void> => {
  await vscode.commands.executeCommand('setContext', `${SNYK_CONTEXT_PREFIX}${key}`, value);
};
