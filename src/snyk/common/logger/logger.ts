import * as vscode from 'vscode';
import { SNYK_NAME } from '../constants/general';
import { ILog, LogLevel } from './interfaces';

class Log implements ILog {
  private output: vscode.OutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel(SNYK_NAME);
  }

  info(message: string): void {
    this.log('Info', message);
  }

  warn(message: string): void {
    this.log('Warn', message);
  }

  error(message: string): void {
    this.log('Error', message);
  }

  debug(message: string): void {
    this.log('Debug', message);
  }

  log(level: LogLevel, message: string): void {
    if (level == 'Debug') {
      return console.log(message);
    }

    this.output.appendLine(`[${level}] ${message}`);
  }

  showOutput() {
    this.output.show();
  }
}

export const Logger = new Log();
