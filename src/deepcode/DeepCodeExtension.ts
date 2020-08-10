import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../interfaces/DeepCodeInterfaces";
import DeepCodeLib from "./lib/modules/DeepCodeLib";

import {
  DEEPCODE_START_COMMAND, 
  DEEPCODE_SETTINGS_COMMAND,
  DEEPCODE_LOGIN,
  DEEPCODE_OPEN_BROWSER,
  DEEPCODE_OPEN_LOCAL,
} from "./constants/commands";
import { openDeepcodeSettingsCommand } from "./utils/vscodeCommandsUtils";

import {
  DEEPCODE_VIEW_SUPPORT,
  DEEPCODE_VIEW_PROGRESS,
  DEEPCODE_VIEW_ANALYSIS,
} from "./constants/views";
import { SupportProvider } from "./view/SupportProvider";
import { ProgressProvider } from "./view/ProgressProvider";
import { IssueProvider } from "./view/IssueProvider";

class DeepCodeExtension extends DeepCodeLib implements DeepCode.ExtensionInterface {
  public activate(context: vscode.ExtensionContext): void {
    this.store.createStore(context);
    this.statusBarItem.show();

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_OPEN_BROWSER,
        (url: string) => open(url)
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_OPEN_LOCAL,
        (path: vscode.Uri, range?: vscode.Range) => {
          console.log("DEEPCODE_OPEN_LOCAL",path.toString());
          vscode.window.showTextDocument(path, { selection: range }).then(
            (f) => console.log(f), 
            (err) => console.error(err)
          );
        }
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_LOGIN,
        this.activateExtensionAnalyzeActions.bind(this)
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_START_COMMAND,
        this.activateExtensionAnalyzeActions.bind(this)
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_SETTINGS_COMMAND,
        openDeepcodeSettingsCommand
      )
    );

    vscode.window.registerTreeDataProvider(
      DEEPCODE_VIEW_SUPPORT, 
      new SupportProvider(this)
    );

    vscode.window.registerTreeDataProvider(
      DEEPCODE_VIEW_PROGRESS, 
      new ProgressProvider(this)
    );

    vscode.window.registerTreeDataProvider(
      DEEPCODE_VIEW_ANALYSIS, 
      new IssueProvider(this)
    );

    context.subscriptions.push(
      { dispose: this.startExtension() },
    );

    this.runMigration();
  }

  private runMigration() {
    // TODO: remove it after 01.06.2020
    // Move 'deepcode.api.cloudBackend' to 'deepcode.url' configuration
    const config = vscode.workspace.getConfiguration('deepcode');
    const oldBaseURL = config.get('api.cloudBackend');
    if (!config.get('url') && oldBaseURL) {
      config.update('url', oldBaseURL, true);
    }
  }

  public startExtension(): any {
    this.activateAll();
    this.activateExtensionAnalyzeActions();
  }

}

export default DeepCodeExtension;
