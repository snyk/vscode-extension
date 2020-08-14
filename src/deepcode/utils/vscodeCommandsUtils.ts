import * as vscode from "vscode";
import { DEEPCODE_EXTENSION_NAME } from "../constants/general";
import {
  DEEPCODE_START_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
  DEEPCODE_CONTEXT_PREFIX,
  DEEPCODE_OPEN_BROWSER,
} from "../constants/commands";

export const openDeepcodeSettingsCommand = (): void => {
  vscode.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, DEEPCODE_EXTENSION_NAME);
};

export const startDeepCodeCommand = (): void => {
  vscode.commands.executeCommand(DEEPCODE_START_COMMAND);
};

export function setContext(key: string, value: unknown) {
  console.log("DeepCode context",key, value);
  vscode.commands.executeCommand('setContext', `${DEEPCODE_CONTEXT_PREFIX}${key}`, value);
};

export function viewInBrowser(url: string) {
  vscode.commands.executeCommand(DEEPCODE_OPEN_BROWSER, url);
};