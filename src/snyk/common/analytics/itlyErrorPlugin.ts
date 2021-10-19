import { ILog } from '../logger/interfaces';
import { Event, Plugin, Properties, ValidationResponse } from '../../../ampli';

export class ItlyErrorPlugin extends Plugin {
  constructor(private logger: ILog) {
    super('snyk-itly-error-plugin');
  }

  postIdentify(
    _userId: string | undefined,
    _properties: Properties | undefined,
    validationResponses: ValidationResponse[],
  ): void {
    this.reportError(validationResponses);
  }

  postGroup(
    _userId: string | undefined,
    _groupId: string,
    _properties: Properties | undefined,
    validationResponses: ValidationResponse[],
  ): void {
    this.reportError(validationResponses);
  }

  postPage(
    _userId: string | undefined,
    _category: string | undefined,
    _name: string | undefined,
    _properties: Properties | undefined,
    validationResponses: ValidationResponse[],
  ): void {
    this.reportError(validationResponses);
  }

  postTrack(_userId: string | undefined, _event: Event, validationResponses: ValidationResponse[]): void {
    this.reportError(validationResponses);
  }

  reportError(validationResponses: ValidationResponse[]): void {
    const errorMessage = validationResponses
      .filter(r => !r.valid)
      .map(r => r.message)
      .join('\n');
    if (errorMessage) {
      // deepcode ignore ExceptionIsNotThrown: <please specify a reason of ignoring this>
      const err = new Error(errorMessage);
      this.logger.debug(`Iteratively validation error: ${err}`);
    }
  }
}
