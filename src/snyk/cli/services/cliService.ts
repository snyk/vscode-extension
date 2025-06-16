export class CliError {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  constructor(public error: string | Error | unknown, public path?: string, public isCancellation = false) {}
}
