/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from 'assert';
import { ILog, LogLevel } from '../../../snyk/common/logger/interfaces';

export class LoggerMock implements ILog {
  log = (_level: LogLevel, _message: string): void => undefined;
  info = (_message: string): void => undefined;
  warn = (_message: string): void => undefined;
  error = (_message: string): void => undefined;
  debug = (_message: string): void => undefined;

  showOutput = (): void => undefined;
}

export class LoggerMockFailOnErrors extends LoggerMock {
  error = (message: string) => assert.fail(message);
}
