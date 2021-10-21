/* eslint-disable @typescript-eslint/no-unused-vars */
import { ILog, LogLevel } from '../../../snyk/common/logger/interfaces';

export class LoggerMock implements ILog {
  log = (_level: LogLevel, _message: string): void => undefined;
  info = (_message: string): void => undefined;
  warn = (_message: string): void => undefined;
  error = (_message: string): void => undefined;
  debug = (_message: string): void => undefined;

  showOutput = (): void => undefined;
}
