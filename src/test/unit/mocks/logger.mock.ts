import assert from 'assert';
import { ILog } from '../../../snyk/common/logger/interfaces';

export class LoggerMock implements ILog {
  info = (_message: string): void => undefined;
  warn = (_message: string): void => undefined;
  error = (_message: string): void => undefined;
  debug = (_message: string): void => undefined;

  showOutput = (): void => undefined;
}

export class LoggerMockFailOnErrors extends LoggerMock {
  error = (message: string) => assert.fail(message);
}
