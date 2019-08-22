import * as vscode from "vscode";
import DeepCode from "../../../interfaces/DeepCodeInterfaces";
import {
  DEEPCODE_NAME,
  DEEPCODE_SETTINGS_COMMAND
} from "../../constants/general";

class DeepCodeStatusBarItem implements DeepCode.StatusBarItemInterface {
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
