import * as Sentry from '@sentry/node';
import { Event, EventHint } from '@sentry/node';
import { SNYK_NAME_EXTENSION } from '../constants/general';

export class ErrorReporting {
  static init(): void {
    new ErrorReporting().initialise();
  }

  private initialise(): void {
    Sentry.init({
      dsn: 'https://c9c301cc174f464b80e8e9a71bbc2664@o30291.ingest.sentry.io/5973186',

      // We recommend adjusting this value in production, or using tracesSampler
      // for finer control
      tracesSampleRate: 1.0,
      environment: 'development',
      beforeSend: this.beforeSend,
    });
  }

  private beforeSend = (event: Event, hint?: EventHint): Event | null => {
    if (!hint) {
      return null;
    }

    //hint.data.mechanism.type == 'onunhandledrejection'
    const error = hint.originalException;
    const extensionTraceRegex = new RegExp(SNYK_NAME_EXTENSION, 'gi');
    if (error && error instanceof Error && error.stack && extensionTraceRegex.exec(error.stack)) {
      return event;
    }

    return null;
  };
}
