import SegmentPlugin from '@itly/plugin-segment-node';
import itly, {
  AnalysisIsReadyProperties,
  AnalysisIsTriggeredProperties as _AnalysisIsTriggeredProperties,
  BackgroundAnalysisNotificationButtonIsClickedProperties,
  BackgroundAnalysisNotificationIsDisplayedProperties,
  FalsePositiveIsSubmittedProperties,
  IssueHoverIsDisplayedProperties,
  IssueInTreeIsClickedProperties,
  QuickFixIsDisplayedProperties as _QuickFixIsDisplayedProperties,
  ScanModeIsSelectedProperties,
  TrackOptions,
} from '../../../ampli';
import { Configuration } from '../configuration/configuration';
import { SnykConfiguration } from '../configuration/snykConfiguration';
import { IDE_NAME } from '../constants/general';
import { ErrorHandler } from '../error/errorHandler';
import { ILog } from '../logger/interfaces';
import { User } from '../user';
import { ItlyErrorPlugin } from './itlyErrorPlugin';

export type SupportedAnalysisProperties =
  | 'Snyk Advisor'
  | 'Snyk Code Quality'
  | 'Snyk Code Security'
  | 'Snyk Open Source';
export type AnalysisIsTriggeredProperties = _AnalysisIsTriggeredProperties & {
  analysisType: [SupportedAnalysisProperties, ...SupportedAnalysisProperties[]];
};

export type SupportedQuickFixProperties =
  | 'Show Suggestion'
  | 'Ignore Suggestion In Line'
  | 'Ignore Suggestion In File'
  | 'Show Most Severe Vulnerability';
export type QuickFixIsDisplayedProperties = _QuickFixIsDisplayedProperties & {
  quickFixType: [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]];
};

export interface IAnalytics {
  load(): Iteratively | null;
  flush(): Promise<void>;
  setShouldReportEvents(shouldReportEvents: boolean): void;
  identify(userId: string): Promise<void>;
  logIssueInTreeIsClicked(properties: IssueInTreeIsClickedProperties): void;
  logAnalysisIsReady(properties: AnalysisIsReadyProperties): void;
  logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void;
  logWelcomeViewIsViewed(): void;
  logAuthenticateButtonIsClicked(): void;
  logWelcomeButtonIsClicked(): void;
  logPluginIsInstalled(): void;
  logQuickFixIsDisplayed(properties: QuickFixIsDisplayedProperties): void;
  logIssueHoverIsDisplayed(properties: IssueHoverIsDisplayedProperties): void;
  logScanModeIsSelected(properties: Omit<ScanModeIsSelectedProperties, 'eventSource' | 'ide'>): void;
  logBackgroundAnalysisNotificationIsDisplayed(
    properties: Omit<BackgroundAnalysisNotificationIsDisplayedProperties, 'eventSource' | 'ide'>,
  ): void;
  logBackgroundAnalysisNotificationButtonIsClicked(
    properties: Omit<BackgroundAnalysisNotificationButtonIsClickedProperties, 'eventSource' | 'ide'>,
  ): void;
  logFalsePositiveIsDisplayed(): void;
  logFalsePositiveIsSubmitted(properties: Omit<FalsePositiveIsSubmittedProperties, 'eventSource' | 'ide'>): void;
}

/**
 * Do not have any dependencies on 'vscode' module to prevent uninstall hook from breaking.
 * Import required dependencies dynamically, if needed.
 */
export class Iteratively implements IAnalytics {
  private readonly ide = IDE_NAME;

  private loaded = false;

  constructor(
    private readonly user: User,
    private logger: ILog,
    private shouldReportEvents: boolean,
    private isDevelopment: boolean,
    private snykConfiguration?: SnykConfiguration,
  ) {}

  setShouldReportEvents(shouldReportEvents: boolean): void {
    this.shouldReportEvents = shouldReportEvents;
    this.load();
  }

  load(): Iteratively | null {
    if (!this.shouldReportEvents) {
      return null;
    }

    const segmentWriteKey = this.snykConfiguration?.segmentWriteKey;
    if (!segmentWriteKey) {
      this.logger.debug('Segment analytics write key is empty. No analytics will be collected.');
      return this;
    }

    const segment = new SegmentPlugin(segmentWriteKey);
    const isDevelopment = this.isDevelopment;

    if (!this.loaded) {
      try {
        itly.load({
          disabled: !this.shouldReportEvents,
          environment: isDevelopment ? 'development' : 'production',
          plugins: [segment, new ItlyErrorPlugin(this.logger)],
        });
      } catch (err) {
        this.logger.warn(`Failed to load analytics: ${err}`);
      }

      this.loaded = true;
    }

    return this;
  }

  public flush = (): Promise<void> => itly.flush();

  async identify(): Promise<void> {
    if (!this.canReportEvents()) {
      return;
    }

    if (!this.user.authenticatedId) {
      this.logger.error('Tried to identify non-authenticated user');
      return;
    }

    // Calling identify is the preferred way to merge authenticated user with anonymous one,
    // see https://snyk.slack.com/archives/C01U2SPRB3Q/p1624276750134700?thread_ts=1624030602.128900&cid=C01U2SPRB3Q
    itly.identify(this.user.authenticatedId, undefined, {
      segment: {
        options: {
          anonymousId: this.user.anonymousId,
          context: {
            app: {
              name: this.ide,
              version: await Configuration.getVersion(),
            },
          },
        },
      },
    });
  }

  public logIssueInTreeIsClicked(properties: IssueInTreeIsClickedProperties): void {
    this.enqueueEvent(() => {
      itly.issueInTreeIsClicked(this.getAuthenticatedUserId(), properties);
    });
  }

  public logAnalysisIsReady(properties: AnalysisIsReadyProperties): void {
    this.enqueueEvent(() => {
      itly.analysisIsReady(this.getAuthenticatedUserId(), properties);
    });
  }

  public logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void {
    this.enqueueEvent(() => {
      itly.analysisIsTriggered(this.getAuthenticatedUserId(), properties);
    });
  }

  public logWelcomeViewIsViewed(): void {
    this.enqueueEvent(() => {
      itly.welcomeIsViewed(
        '',
        {
          ide: this.ide,
        },
        this.getAnonymousSegmentOptions(),
      );
    }, false);
  }

  public logAuthenticateButtonIsClicked(): void {
    this.enqueueEvent(() => {
      itly.authenticateButtonIsClicked(
        '',
        {
          ide: this.ide,
          eventSource: 'IDE',
        },
        this.getAnonymousSegmentOptions(),
      );
    }, false);
  }

  public logWelcomeButtonIsClicked(): void {
    this.enqueueEvent(() => {
      itly.welcomeButtonIsClicked(
        this.user.authenticatedId ?? '',
        {
          ide: this.ide,
          eventSource: 'IDE',
        },
        this.getAnonymousSegmentOptions(),
      );
    }, false);
  }

  public logPluginIsInstalled(): void {
    this.enqueueEvent(() => {
      itly.pluginIsInstalled(
        '',
        {
          ide: this.ide,
        },
        {
          segment: {
            options: {
              anonymousId: this.user.anonymousId,
            },
          },
        },
      );
    });
  }

  public logQuickFixIsDisplayed(properties: QuickFixIsDisplayedProperties): void {
    this.enqueueEvent(() => {
      itly.quickFixIsDisplayed(this.getAuthenticatedUserId(), properties);
    });
  }

  public logIssueHoverIsDisplayed(properties: IssueHoverIsDisplayedProperties): void {
    this.enqueueEvent(() => {
      itly.issueHoverIsDisplayed(this.getAuthenticatedUserId(), properties);
    });
  }

  public logScanModeIsSelected(properties: Omit<ScanModeIsSelectedProperties, 'eventSource' | 'ide'>): void {
    this.enqueueEvent(() => {
      itly.scanModeIsSelected(this.getAuthenticatedUserId(), {
        ...properties,
        ide: this.ide,
        eventSource: 'IDE',
      });
    });
  }

  public logBackgroundAnalysisNotificationIsDisplayed(
    properties: Omit<BackgroundAnalysisNotificationIsDisplayedProperties, 'eventSource' | 'ide'>,
  ): void {
    this.enqueueEvent(() => {
      itly.backgroundAnalysisNotificationIsDisplayed(this.getAuthenticatedUserId(), {
        ...properties,
        ide: this.ide,
        eventSource: 'IDE',
      });
    });
  }

  public logBackgroundAnalysisNotificationButtonIsClicked(
    properties: Omit<BackgroundAnalysisNotificationButtonIsClickedProperties, 'eventSource' | 'ide'>,
  ): void {
    this.enqueueEvent(() => {
      itly.backgroundAnalysisNotificationButtonIsClicked(this.getAuthenticatedUserId(), {
        ...properties,
        ide: this.ide,
        eventSource: 'IDE',
      });
    });
  }

  public logFalsePositiveIsDisplayed(): void {
    this.enqueueEvent(() => {
      itly.falsePositiveIsDisplayed(this.getAuthenticatedUserId(), {
        ide: this.ide,
        eventSource: 'IDE',
      });
    });
  }

  public logFalsePositiveIsSubmitted(
    properties: Omit<FalsePositiveIsSubmittedProperties, 'eventSource' | 'ide'>,
  ): void {
    this.enqueueEvent(() => {
      itly.falsePositiveIsSubmitted(this.getAuthenticatedUserId(), {
        ...properties,
        ide: this.ide,
        eventSource: 'IDE',
      });
    });
  }

  private enqueueEvent(eventFunction: () => void, mustBeAuthenticated = true): void {
    if (!this.canReportEvents()) {
      return;
    }
    if (mustBeAuthenticated && !this.user.authenticatedId) {
      return;
    }

    eventFunction();
  }

  private canReportEvents(): boolean {
    if (!this.loaded) {
      this.logger.debug('Cannot report events because Iteratively not loaded.');
      return false;
    }

    if (!this.shouldReportEvents) {
      return false;
    }

    return true;
  }

  private getAnonymousSegmentOptions(): TrackOptions {
    return {
      segment: {
        options: {
          anonymousId: this.user.anonymousId,
        },
      },
    };
  }

  private getAuthenticatedUserId(): string {
    if (!this.user.authenticatedId) {
      const err = new Error('User must be authenticated for analytics');
      ErrorHandler.handle(err, this.logger);
      throw err;
    }

    return this.user.authenticatedId;
  }
}
