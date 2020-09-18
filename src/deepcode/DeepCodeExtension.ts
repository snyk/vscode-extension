import * as vscode from "vscode";
import * as open from "open";

import DeepCode from "../interfaces/DeepCodeInterfaces";
import DeepCodeLib from "./lib/modules/DeepCodeLib";

import {
  DEEPCODE_START_COMMAND,
  DEEPCODE_SETMODE_COMMAND,
  DEEPCODE_SETTINGS_COMMAND,
  DEEPCODE_DCIGNORE_COMMAND,
  DEEPCODE_LOGIN_COMMAND,
  DEEPCODE_APPROVE_COMMAND,
  DEEPCODE_OPEN_BROWSER_COMMAND,
  DEEPCODE_OPEN_LOCAL_COMMAND,
  DEEPCODE_OPEN_ISSUE_COMMAND,
} from "./constants/commands";
import {
  openDeepcodeSettingsCommand,
  createDCIgnoreCommand,
} from "./utils/vscodeCommandsUtils";
import { errorsLogs } from "./messages/errorsServerLogMessages";
import {
  DEEPCODE_VIEW_SUPPORT,
  DEEPCODE_VIEW_ANALYSIS,
} from "./constants/views";
import { SupportProvider } from "./view/SupportProvider";
import { IssueProvider } from "./view/IssueProvider";

class DeepCodeExtension extends DeepCodeLib implements DeepCode.ExtensionInterface {
  context: vscode.ExtensionContext | undefined;

  private async executeCommand(
    name: string,
    fn: (...args: any[]) => Promise<any>,
    ...args: any[]
  ): Promise<any> {
    try {
      await fn(...args);
    } catch (error) {
      await this.processError(error, {
        message: errorsLogs.command(name),
      });
    }
  }
  
  public activate(context: vscode.ExtensionContext): void {
    this.context = context;
    this.activateAll();
    this.statusBarItem.show();

    // context.subscriptions.push(
    //   vscode.commands.registerCommand(
    //     'deepcode.test',
    //     () => {
    //       this.suggestionProvider.show({test: 'test'});
    //     }
    //   )
    // );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_OPEN_BROWSER_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_OPEN_BROWSER_COMMAND,
          (url: string) => open(url)
        )
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_OPEN_LOCAL_COMMAND,
        (path: vscode.Uri, range?: vscode.Range) => {
          vscode.window.showTextDocument(path, {
            viewColumn: vscode.ViewColumn.One,
            selection: range
          }).then(
            // no need to wait for processError since then is called asynchronously as well
            () => {}, (err) => this.processError(err, {
              message: errorsLogs.command(DEEPCODE_OPEN_LOCAL_COMMAND),
            })
          );
        }
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_LOGIN_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_LOGIN_COMMAND,
          this.initiateLogin.bind(this)
        )
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_APPROVE_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_APPROVE_COMMAND,
          this.approveUpload.bind(this)
        )
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_START_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_START_COMMAND,
          this.startExtension.bind(this)
        )
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_SETMODE_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_SETMODE_COMMAND,
          this.setMode.bind(this)
        )
      )
    );
    
    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_SETTINGS_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_SETTINGS_COMMAND,
          openDeepcodeSettingsCommand
        )
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_OPEN_ISSUE_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_OPEN_ISSUE_COMMAND,
          async (
            issueId: string,
            severity: number,
            uri: vscode.Uri,
            range: vscode.Range,
            // markers and cross-file analysis
            openUri?: vscode.Uri,
            openRange?: vscode.Range,
          ) => {
            await vscode.commands.executeCommand(
              DEEPCODE_OPEN_LOCAL_COMMAND, openUri || uri, openRange || range
            );
            this.suggestionProvider.show(issueId, uri, range);
            await this.trackViewSuggestion(issueId, severity);
          }
        )
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        DEEPCODE_DCIGNORE_COMMAND,
        this.executeCommand.bind(
          this,
          DEEPCODE_DCIGNORE_COMMAND,
          createDCIgnoreCommand
        )
      )
    );

    vscode.window.registerTreeDataProvider(
      DEEPCODE_VIEW_SUPPORT, 
      new SupportProvider(this)
    );

    vscode.window.registerTreeDataProvider(
      DEEPCODE_VIEW_ANALYSIS, 
      new IssueProvider(this)
    );

    this.startExtension().catch((err) => this.processError(err, {
      message: errorsLogs.failedExecution,
    }));
    this.checkWelcomeNotification().catch((err) => this.processError(err, {
      message: errorsLogs.welcomeNotification,
    }));
    this.checkAdvancedMode().catch((err) => this.processError(err, {
      message: errorsLogs.checkAdvancedMode,
    }));
  }

}

export default DeepCodeExtension;
