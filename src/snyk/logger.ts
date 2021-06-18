import * as vscode from 'vscode';
import { ILog, LogLevel } from '../interfaces/loggerInterface';
import { SNYK_NAME } from './constants/general';

class Log implements ILog {
  private output: vscode.OutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel(SNYK_NAME);
  }

  public info(message: string): void {
    this.log('Info', message);
  }

  public warn(message: string): void {
    this.log('Warn', message);
  }

  public error(message: string): void {
    this.log('Error', message);
  }

  public debug(message: string): void {
    this.log('Debug', message);
  }

  public log(level: LogLevel, message: string): void {
    if (level == 'Debug') {
      return console.log(message);
    }

    this.output.appendLine(`[${level}] ${message}`);
  }
}

export const Logger = new Log();
