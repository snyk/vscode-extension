import * as vscode from 'vscode';
import { SNYK_CONTEXT_PREFIX } from '../constants/commands';

export const setContext = async (key: string, value: unknown): Promise<void> => {
  await vscode.commands.executeCommand('setContext', `${SNYK_CONTEXT_PREFIX}${key}`, value);
};
