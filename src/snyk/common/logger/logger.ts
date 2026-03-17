import * as vscode from 'vscode';
import { SNYK_NAME } from '../constants/general';
import { IClassLog, IFuncLog, ILog } from './interfaces';

class Log implements ILog {
  private output: vscode.LogOutputChannel;

  constructor() {
    this.output = vscode.window.createOutputChannel(SNYK_NAME, { log: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info(message: string | unknown): void {
    this.output.info(`${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn(message: string | Error | unknown): void {
    this.output.warn(`${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error(message: string | Error | unknown): void {
    this.output.error(`${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug(message: string | unknown): void {
    this.output.debug(`${message}`);
  }

  showOutput() {
    this.output.show();
  }

  classLog(className: typeof Function.name): IClassLog {
    return new ClassLog(this, className);
  }
}

class ClassLog implements IClassLog {
  constructor(private readonly baseLogger: ILog, private readonly className: typeof Function.name) {}

  funcLog(funcName: typeof Function.name): IFuncLog {
    return new FuncLog(this.baseLogger, this.className, funcName);
  }
}

class FuncLog implements IFuncLog {
  constructor(
    private readonly baseLogger: ILog,
    private readonly className: typeof Function.name,
    private readonly funcName: typeof Function.name,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info(message: string | unknown): void {
    this.baseLogger.info(`${this.className}.${this.funcName} - ${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn(message: string | Error | unknown): void {
    this.baseLogger.warn(`${this.className}.${this.funcName} - ${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error(message: string | Error | unknown): void {
    this.baseLogger.error(`${this.className}.${this.funcName} - ${message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug(message: string | unknown): void {
    this.baseLogger.debug(`${this.className}.${this.funcName} - ${message}`);
  }
}

export const Logger = new Log();
