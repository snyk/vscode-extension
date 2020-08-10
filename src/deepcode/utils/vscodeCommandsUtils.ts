import * as vscode from "vscode";
import { DEEPCODE_NAME } from "../constants/general";
import {
  DEEPCODE_START_COMMAND,
  VSCODE_GO_TO_SETTINGS_COMMAND,
  DEEPCODE_CONTEXT_PREFIX,
  DEEPCODE_OPEN_BROWSER,
} from "../constants/commands";

export const getDeepcodeExtensionId = (): string => {
  const extension = vscode.extensions.all.find(
    extension => extension.packageJSON.displayName === DEEPCODE_NAME
  );
  return extension ? extension.packageJSON.id : "";
};

export const openDeepcodeSettingsCommand = (): void => {
  const deepcodeId = getDeepcodeExtensionId();
  vscode.commands.executeCommand(VSCODE_GO_TO_SETTINGS_COMMAND, deepcodeId);
};

export const startDeepCodeCommand = (): void => {
  vscode.commands.executeCommand(DEEPCODE_START_COMMAND);
};

export function setContext(key: string, value: unknown) {
  vscode.commands.executeCommand('setContext', `${DEEPCODE_CONTEXT_PREFIX}${key}`, value);
};

export function viewInBrowser(url: string) {
  vscode.commands.executeCommand(DEEPCODE_OPEN_BROWSER, url);
};