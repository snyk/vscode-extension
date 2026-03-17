import assert from 'assert';
import { IClassLog, IFuncLog, ILog } from '../../../snyk/common/logger/interfaces';

export class LogMock implements ILog {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info = (_message: string | unknown): void => undefined;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn = (_message: string | Error | unknown): void => undefined;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error = (_message: string | Error | unknown): void => undefined;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug = (_message: string | unknown): void => undefined;

  showOutput = (): void => undefined;

  classLog(_className: typeof Function.name): IClassLog {
    return new ClassLogMock(this);
  }
}

export class ClassLogMock implements IClassLog {
  constructor(private readonly baseLog: ILog) {}

  funcLog(_funcName: typeof Function.name): IFuncLog {
    return new FuncLogMock(this.baseLog);
  }
}

export class FuncLogMock implements IFuncLog {
  constructor(private readonly baseLog: ILog) {}

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info = (message: string | unknown): void => this.baseLog.info(message);
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn = (message: string | Error | unknown): void => this.baseLog.warn(message);
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error = (message: string | Error | unknown): void => this.baseLog.error(message);
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug = (message: string | unknown): void => this.baseLog.debug(message);
}

export class LogMockFailOnErrors extends LogMock {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error = (message: string | Error | unknown) => assert.fail(`${message}`);
}
