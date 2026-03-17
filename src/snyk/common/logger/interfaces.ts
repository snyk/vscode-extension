interface ILoggable {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info(message: string | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn(message: string | Error | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error(message: string | Error | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug(message: string | unknown): void;
}

export interface ILog extends ILoggable {
  showOutput(): void;

  classLog(className: typeof Function.name): IClassLog;
}

export interface IClassLog {
  funcLog(functionName: typeof Function.name): IFuncLog;
}

export interface IFuncLog extends ILoggable {}
