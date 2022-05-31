import * as Sentry from '@sentry/node';
import { Contexts, Transport, TransportClass } from '@sentry/types';
import { Configuration, IConfiguration } from '../configuration/configuration';
import { SnykConfiguration } from '../configuration/snykConfiguration';
import { ILog } from '../logger/interfaces';
import { Platform } from '../platform';
import { User } from '../user';
import { IVSCodeEnv } from '../vscode/env';
import { OnUncaughtException } from './integrations/onUncaughtException';

type SentryEnvironment = 'development' | 'preview' | 'production';

export enum TagKeys {
  CodeRequestId = 'code_request_id',
}
export type Tags = { [key in TagKeys]?: string };

export class ErrorReporter {
  private static readonly eventQueueTimeoutMs = 1000;

  /**
   * 'OnUncaughException' integration must be ignored since it causes Sentry to permanently fail during runtime. Default Sentry behaviour is to call process.exit() for uncaught errors.
   * This is being prevented by VS Code and is logged as:
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

  static async init(
    userConfig: IConfiguration,
    snykConfig: SnykConfiguration,
    extensionPath: string,
    vscodeEnv: IVSCodeEnv,
    logger: ILog,
    transport?: TransportClass<Transport>,
  ): Promise<void> {
    if (!snykConfig.sentryKey) {
      logger.warn('Error reporting not initialized - key not provided.');
      return;
    }

    Sentry.init({
      dsn: snykConfig.sentryKey,
      maxBreadcrumbs: 50,
      debug: userConfig.isDevelopment,
      environment: await ErrorReporter.getEnvironment(userConfig),
      release: await Configuration.getVersion(),
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

  static capture(e: Error | unknown, tags?: Tags): string | undefined {
    const isInitialized = Sentry.getCurrentHub().getClient();
    if (isInitialized) {
      if (tags && Object.keys(tags).length > 0) {
        Sentry.withScope(scope => {
          Object.keys(tags).forEach(tag => scope.setTag(tag, tags[tag] as string));
          return Sentry.captureException(e);
        });
      } else {
        return Sentry.captureException(e);
      }
    }
  }

  static identify(user: User): void {
    Sentry.setUser({
      id: user.hashedAuthenticatedId,
    });
  }

  static flush(): Promise<boolean> {
    return Sentry.close(this.eventQueueTimeoutMs);
  }

  private static getContexts(vscodeEnv: IVSCodeEnv, contexts?: Contexts): Contexts {
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

  private static async getEnvironment(userConfig: IConfiguration): Promise<SentryEnvironment> {
    if (userConfig.isDevelopment) {
      return 'development';
    } else if (await Configuration.isPreview()) {
      return 'preview';
    }

    return 'production';
  }
}
