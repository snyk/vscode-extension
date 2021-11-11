import SegmentPlugin from '@itly/plugin-segment-node';
import path from 'path';
import itly, {
  AnalysisIsReadyProperties,
  AnalysisIsTriggeredProperties as _AnalysisIsTriggeredProperties,
  IssueHoverIsDisplayedProperties,
  IssueInTreeIsClickedProperties,
  QuickFixIsDisplayedProperties as _QuickFixIsDisplayedProperties,
  TrackOptions,
} from '../../../ampli';
import { Configuration } from '../configuration/configuration';
import { SnykConfiguration } from '../configuration/snykConfiguration';
import { IDE_NAME } from '../constants/general';
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
  load(): Promise<Iteratively | null>;
  flush(): Promise<void>;
  setShouldReportEvents(shouldReportEvents: boolean): Promise<void>;
  identify(userId: string): void;
  logIssueInTreeIsClicked(properties: IssueInTreeIsClickedProperties): void;
  logAnalysisIsReady(properties: AnalysisIsReadyProperties): void;
  logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void;
  logWelcomeViewIsViewed(): void;
  logAuthenticateButtonIsClicked(): void;
  logWelcomeButtonIsClicked(): void;
  logPluginIsInstalled(): void;
  logPluginIsUninstalled(userId?: string): void;
  logQuickFixIsDisplayed(properties: QuickFixIsDisplayedProperties): void;
  logIssueHoverIsDisplayed(properties: IssueHoverIsDisplayedProperties): void;
}

/**
 * Do not have any dependencies on 'vscode' module to prevent uninstall hook from breaking.
 * Import required dependencies dynamically, if needed.
 */
export class Iteratively implements IAnalytics {
  private readonly ide = IDE_NAME;

  private loaded = false;
  private configsPath = '../../../..';

  constructor(
    private readonly user: User,
    private logger: ILog,
    private shouldReportEvents: boolean,
    private isDevelopment: boolean,
  ) {}

  async setShouldReportEvents(shouldReportEvents: boolean): Promise<void> {
    this.shouldReportEvents = shouldReportEvents;
    await this.load();
  }

  async load(): Promise<Iteratively | null> {
    if (!this.shouldReportEvents) {
      return null;
    }

    const snykConfiguration = await SnykConfiguration.get(path.join(this.configsPath));
    let segmentWriteKey = snykConfiguration.segmentWriteKey;

    if (!segmentWriteKey) {
      this.logger.debug('Segment analytics write key is empty. No analytics will be collected.');
      return this;
    } else if (this.isDevelopment) {
      segmentWriteKey = process.env.SNYK_VSCE_SEGMENT_WRITE_KEY ?? '';
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

  public identify(): void {
    if (!this.canReportEvents()) {
      return;
    }

    if (!this.user.authenticatedId) {
      this.logger.error('Tried to identify non-authenticated user');
      return;
    }

    // Calling identify again is the preferred way to merge authenticated user with anonymous one,
    // see https://snyk.slack.com/archives/C01U2SPRB3Q/p1624276750134700?thread_ts=1624030602.128900&cid=C01U2SPRB3Q
    itly.identify(this.user.authenticatedId, undefined, {
      segment: {
        options: {
          anonymousId: this.user.anonymousId,
          context: {
            app: {
              name: this.ide,
              version: Configuration.version,
            },
          },
        },
      },
    });
  }

  public logIssueInTreeIsClicked(properties: IssueInTreeIsClickedProperties): void {
    if (!this.canReportEvents() || !this.user.authenticatedId) {
      return;
    }

    itly.issueInTreeIsClicked(this.user.authenticatedId, properties);
  }

  public logAnalysisIsReady(properties: AnalysisIsReadyProperties): void {
    if (!this.canReportEvents() || !this.user.authenticatedId) {
      return;
    }

    itly.analysisIsReady(this.user.authenticatedId, properties);
  }

  public logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void {
    if (!this.canReportEvents() || !this.user.authenticatedId) {
      return;
    }

    itly.analysisIsTriggered(this.user.authenticatedId, properties);
  }

  public logWelcomeViewIsViewed(): void {
    if (!this.canReportEvents()) {
      return;
    }

    itly.welcomeIsViewed(
      '',
      {
        ide: this.ide,
      },
      this.getAnonymousSegmentOptions(),
    );
  }

  public logAuthenticateButtonIsClicked(): void {
    if (!this.canReportEvents()) {
      return;
    }

    itly.authenticateButtonIsClicked(
      '',
      {
        ide: this.ide,
        eventSource: 'IDE',
      },
      this.getAnonymousSegmentOptions(),
    );
  }

  public logWelcomeButtonIsClicked(): void {
    if (!this.canReportEvents()) {
      return;
    }

    itly.welcomeButtonIsClicked(
      this.user.authenticatedId ?? '',
      {
        ide: this.ide,
        eventSource: 'IDE',
      },
      this.getAnonymousSegmentOptions(),
    );
  }

  public logPluginIsInstalled(): void {
    if (!this.canReportEvents()) {
      return;
    }

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
  }

  public logPluginIsUninstalled(): void {
    const userId = this.user.authenticatedId ?? this.user.anonymousId;

    if (!this.canReportEvents() || !userId) {
      return;
    }

    itly.pluginIsUninstalled(userId, {
      ide: this.ide,
    });
  }

  public logQuickFixIsDisplayed(properties: QuickFixIsDisplayedProperties): void {
    if (!this.canReportEvents() || !this.user.authenticatedId) {
      return;
    }

    itly.quickFixIsDisplayed(this.user.authenticatedId, properties);
  }

  public logIssueHoverIsDisplayed(properties: IssueHoverIsDisplayedProperties): void {
    if (!this.canReportEvents() || !this.user.authenticatedId) {
      return;
    }

    itly.issueHoverIsDisplayed(this.user.authenticatedId, properties);
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
}
