import { getCurrentHub, Scope } from '@sentry/core';
import { Integration, Severity } from '@sentry/types';

/** Uncaught exception handler based on the Sentry Node.js global handler:
 * https://github.dev/getsentry/sentry-javascript/blob/a565aaaeff6ede4bf2ca75b55f919df2c059415b/packages/node/src/integrations/onuncaughtexception.ts#L1-L129.
 * The handler tracks uncaught errors and captures only the ones that have extension path as part of the error stacktrace, since VS Code extensions are running in separate folders on the file system.
 */
export class OnUncaughtException implements Integration {
  /**
   * @inheritDoc
   */
  static id = 'OnSnykUncaughtException';

  /**
   * @inheritDoc
   */
  name: string = OnUncaughtException.id;

  /**
   * @inheritDoc
   */
  readonly handler: (error: Error) => void = this.makeErrorHandler();

  /**
   * @inheritDoc
   */
  constructor(
    private readonly options: {
      /**
       * Extension path where stack traces should originate from.
       */
      extensionPath: string;
    },
  ) {}

  /**
   * @inheritDoc
   */
  setupOnce(): void {
    global.process.on('uncaughtException', (error: Error) => this.handler(error));
  }

  isExtensionOriginError(error: Error): boolean {
    const extensionTraceRegex = new RegExp(this.options.extensionPath, 'gi');

    if (error && error instanceof Error && error.stack && extensionTraceRegex.exec(error.stack)) {
      // The error doesn't belong to Snyk extension, ignore it
      return true;
    }

    return false;
  }

  /**
   * @hidden
   */
  private makeErrorHandler(): (error: Error) => void {
    return (error: Error): void => {
      if (!this.isExtensionOriginError(error)) {
        return;
      }

      const hub = getCurrentHub();
      if (hub.getIntegration(OnUncaughtException)) {
        hub.withScope((scope: Scope) => {
          scope.setLevel(Severity.fromString('fatal'));
          hub.captureException(error, {
            originalException: error,
            data: { mechanism: { handled: false, type: 'onuncaughtexception' } },
          });
        });
      }
    };
  }
}
