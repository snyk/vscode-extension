import * as vscode from "vscode";
import { DEEPCODE_START_COMMAND, DEEPCODE_NAME } from "../constants/general";
import { stateNames } from "../constants/stateNames";

export const getDeepcodeExtensionId = (): string => {
  const extension = vscode.extensions.all.find(
    extension => extension.packageJSON.displayName === DEEPCODE_NAME
  );
  return extension ? extension.packageJSON.id : "";
};

export const openDeepcodeSettingsCommand = (): void => {
  const deepcodeId = getDeepcodeExtensionId();
  vscode.commands.executeCommand("_extensions.manage", deepcodeId);
};

export const startDeepCodeCommand = (): void => {
  vscode.commands.executeCommand(DEEPCODE_START_COMMAND);
};
