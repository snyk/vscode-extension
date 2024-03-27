import * as vscode from 'vscode';

export interface IVSCodeCommands {
  executeCommand<T>(command: string, ...rest: unknown[]): Thenable<T | undefined>;
}

class VSCodeCommands implements IVSCodeCommands {
  executeCommand<T>(command: string, ...rest: unknown[]): Thenable<T | undefined> {
    return vscode.commands.executeCommand(command, ...rest);
  }
}

export const vsCodeCommands = new VSCodeCommands();
