export class CliError {
  constructor(public error: string | Error | unknown, public path?: string, public isCancellation = false) {}
}
