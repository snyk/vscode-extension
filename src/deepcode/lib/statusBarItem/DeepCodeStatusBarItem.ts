import * as vscode from "vscode";
import { StatusBarItemInterface } from "../../../interfaces/DeepCodeInterfaces";
import { DEEPCODE_NAME } from "../../constants/general";
import { DEEPCODE_SETTINGS_COMMAND } from "../../constants/commands";

class DeepCodeStatusBarItem implements StatusBarItemInterface {
  public deepcodeStatusBarItem: vscode.StatusBarItem;
  public constructor() {
    this.deepcodeStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      0
    );
    this.deepcodeStatusBarItem.text = DEEPCODE_NAME;
  }

  public show(): void {
    this.deepcodeStatusBarItem.command = DEEPCODE_SETTINGS_COMMAND;
    this.deepcodeStatusBarItem.show();
  }
}

export default DeepCodeStatusBarItem;
