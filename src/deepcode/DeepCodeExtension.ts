import * as vscode from "vscode";
import { IConfig } from "@deepcode/tsc";

import DeepCode from "../interfaces/DeepCodeInterfaces";
import DeepCodeLib from "./lib/modules/DeepCodeLib";
import http from "./http/requests";

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

  public initAPI(config: IConfig): void {
    http.init(config);
  }
}

export default DeepCodeExtension;
