import * as vscode from 'vscode';
import { SNYK_NAME } from '../constants/general';
import { ILog, LogLevel } from './interfaces';

class Log implements ILog {
  private output: vscode.LogOutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel(SNYK_NAME, { log: true });
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
  private log(level: LogLevel, message: string | Error | unknown): void {
    switch (level) {
      case 'Error':
        this.output.error(`${message}`);
        break;
      case 'Warn':
        this.output.warn(`${message}`);
        break;
      case 'Info':
        this.output.info(`${message}`);
        break;
      case 'Debug':
        this.output.debug(`${message}`);
        break;
      default:
        this.output.appendLine(`${message}`);
        break;
    }
  }

  showOutput() {
    this.output.show();
  }
}

export const Logger = new Log();
