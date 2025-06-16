export type LogLevel = 'Info' | 'Warn' | 'Error' | 'Debug';

export interface ILog {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  info(message: string | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  warn(message: string | Error | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  error(message: string | Error | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  debug(message: string | unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  log(level: LogLevel, message: string | Error | unknown): void;

  showOutput(): void;
}
