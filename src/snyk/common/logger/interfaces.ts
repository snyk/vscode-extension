export type LogLevel = 'Info' | 'Warn' | 'Error' | 'Debug';

export interface ILog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;

  log(level: LogLevel, message: string): void;

  showOutput(): void;
}
