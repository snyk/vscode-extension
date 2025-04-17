import * as vscode from 'vscode';
import { SNYK_NAME } from '../constants/general';
import { ILog, LogLevel } from './interfaces';

class Log implements ILog {
  private output: vscode.OutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel(SNYK_NAME);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info(message: string | unknown): void {
    this.log('Info', message);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn(message: string | Error | unknown): void {
    this.log('Warn', message);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error(message: string | Error | unknown): void {
    this.log('Error', message);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug(message: string | unknown): void {
    this.log('Debug', message);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  log(level: LogLevel, message: string | Error | unknown): void {
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
