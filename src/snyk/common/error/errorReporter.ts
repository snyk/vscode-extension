import * as Sentry from '@sentry/node';
import { Contexts, Transport, TransportClass } from '@sentry/types';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { SnykConfiguration } from '../configuration/snykConfiguration';
import { ILog } from '../logger/interfaces';
import { Platform } from '../platform';
import { IVSCodeEnv } from '../vscode/env';
import { OnUncaughtException } from './integrations/onUncaughtException';

export class ErrorReporter {
  private static readonly eventQueueTimeoutMs = 1000;

  /**
   * 'OnUncaughException' integration must be ignored since it causes Sentry to permanently fail during runtime. Default Sentry behaviour is to call process.exit() for uncaught errors. This is being prevented by VS Code and is logged as:
   * --- "An extension called process.exit() and this was prevented.".
   * As a result, Sentry shuts down and doesn't log any caught errors:
   * --- "Sentry Logger [Warn]: uncaught exception after calling fatal error shutdown callback - this is bad! forcing shutdown".
   *
   * 'OnUnhandledRejection' must be ignored as well, since it captures unhandled rejections from other extensions running in the extension host and there's no way to determine which extension does the unhandled rejection belong to.
   *
   * Integrations reference: https://docs.sentry.io/platforms/node/configuration/integrations/default-integrations/
   */
  private static readonly nonValidIntegrations = [
    Sentry.Integrations.OnUncaughtException.id,
    Sentry.Integrations.OnUnhandledRejection.id,
  ];

  static init(
    userConfig: IConfiguration,
    snykConfig: SnykConfiguration,
    extensionPath: string,
    vscodeEnv: IVSCodeEnv,
    logger: ILog,
    transport?: TransportClass<Transport>,
  ): void {
    if (!snykConfig.sentryKey) {
      logger.warn('Error reporting not initialized - key not provided.');
      return;
    }

    // todo: add version number
    Sentry.init({
      dsn: snykConfig.sentryKey,
      maxBreadcrumbs: 50,
      debug: userConfig.isDevelopment,
      environment: userConfig.isDevelopment ? 'development' : 'production',
      release: Configuration.version,
      transport,
      integrations(integrations) {
        return [
          ...integrations.filter(
            integration =>
              !ErrorReporter.nonValidIntegrations.map(i => i.toLowerCase()).includes(integration.name.toLowerCase()),
          ),
          new OnUncaughtException({ extensionPath }), // custom integration for uncaught exceptions
        ];
      },
      beforeSend(event) {
        // drop reporting, if user doesn't want to report events here
        // https://github.com/getsentry/sentry-javascript/issues/2039
        if (!userConfig.shouldReportErrors) {
          return null;
        }

        event.contexts = ErrorReporter.getContexts(vscodeEnv, event.contexts);
        return event;
      },
    });
  }

  static capture(e: Error): string | undefined {
    const isInitialized = Sentry.getCurrentHub().getClient();
    if (isInitialized) {
      return Sentry.captureException(e);
    }
  }

  static flush(): Promise<boolean> {
    return Sentry.close(this.eventQueueTimeoutMs);
  }

  private static getContexts(vscodeEnv: IVSCodeEnv, contexts?: Contexts) {
    return {
      ...contexts,
      os: {
        name: Platform.getCurrent(),
        version: Platform.getVersion(),
      },
      vscode: {
        appName: vscodeEnv.getAppName(),
        appHost: vscodeEnv.getAppHost(),
        uiKind: vscodeEnv.getUiKind(),
        remoteName: vscodeEnv.getRemoteName(),
      },
    };
  }
}
