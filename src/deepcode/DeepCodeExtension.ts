import * as vscode from "vscode";
import DeepCode from "../interfaces/DeepCodeInterfaces";
import DeepCodeLib from "./lib/modules/DeepCodeLib";

import {
  DEEPCODE_START_COMMAND,
  DEEPCODE_SETTINGS_COMMAND
} from "./constants/commands";
import { openDeepcodeSettingsCommand } from "./utils/vscodeCommandsUtils";

class DeepCodeExtension extends DeepCodeLib
  implements DeepCode.ExtensionInterface {
  public activate(context: vscode.ExtensionContext): void {
    this.store.createStore(context);
    this.statusBarItem.show();

    let deepcodeCommand = vscode.commands.registerCommand(
      DEEPCODE_START_COMMAND,
      () => {
        this.cancelFirstSaveFlag();
        this.startExtension();
      }
    );

    let deepcodeSettingsCommand = vscode.commands.registerCommand(
      DEEPCODE_SETTINGS_COMMAND,
      openDeepcodeSettingsCommand
    );
    context.subscriptions.push(
      { dispose: this.startExtension() },
      deepcodeCommand,
      deepcodeSettingsCommand
    );
  }

  public startExtension(): any {
    (async (): Promise<void> => {
      this.preActivateActions();
    })();
  }
}

export default DeepCodeExtension;
