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

export const setContext = (key: string, value: unknown): void => {
  console.log("DeepCode context",key, value);
  vscode.commands.executeCommand('setContext', `${DEEPCODE_CONTEXT_PREFIX}${key}`, value);
};

export const viewInBrowser = (url: string): void => {
  vscode.commands.executeCommand(DEEPCODE_OPEN_BROWSER, url);
};