/* eslint-disable @typescript-eslint/no-var-requires */
import SegmentPlugin from '@itly/plugin-segment-node';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import itly, {
  AnalysisIsReadyProperties,
  AnalysisIsTriggeredProperties as _AnalysisIsTriggeredProperties,
  IssueHoverIsDisplayedProperties,
  IssueInTreeIsClickedProperties,
  QuickFixIsDisplayedProperties as _QuickFixIsDisplayedProperties,
} from '../../../ampli';
import { Configuration } from '../configuration/configuration';
import { IDE_NAME } from '../constants/general';
import { ILog } from '../logger/interfaces';
import { ItlyErrorPlugin } from './itlyErrorPlugin';

export type SupportedAnalysisProperties =
  | 'Snyk Advisor'
  | 'Snyk Code Quality'
  | 'Snyk Code Security'
  | 'Snyk Open Source';
export type AnalysisIsTriggeredProperties = _AnalysisIsTriggeredProperties & {
  analysisType: [SupportedAnalysisProperties, ...SupportedAnalysisProperties[]];
};

export type SupportedQuickFixProperties = 'Show Suggestion' | 'Ignore Suggestion In Line' | 'Ignore Suggestion In File';
export type QuickFixIsDisplayedProperties = _QuickFixIsDisplayedProperties & {
  quickFixType: [SupportedQuickFixProperties, ...SupportedQuickFixProperties[]];
};

export interface IAnalytics {
  load(): Iteratively | null;
  flush(): Promise<void>;
  setShouldReportEvents(shouldReportEvents: boolean): void;
  identify(userId: string): void;
  logIssueInTreeIsClicked(properties: IssueInTreeIsClickedProperties): void;
  logAnalysisIsReady(properties: AnalysisIsReadyProperties): void;
  logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void;
  logWelcomeViewIsViewed(): void;
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
  private readonly anonymousId: string;
  private loaded = false;
  private userId: string;

  private configsPath = '../../../..';

  constructor(private logger: ILog, private shouldReportEvents: boolean, private isDevelopment: boolean) {
    this.anonymousId = uuidv4();
  }

  public setShouldReportEvents(shouldReportEvents: boolean): void {
    this.shouldReportEvents = shouldReportEvents;
    this.load();
  }

  public load(): Iteratively | null {
    if (!this.shouldReportEvents) {
      return null;
    }

    let { segmentWriteKey } = require(path.join(this.configsPath, '/snyk.config.json')) as { segmentWriteKey: string };
    if (!segmentWriteKey) {
      this.logger.debug('Segment analytics write key is empty. No analytics will be collected.');
      return this;
    } else if (this.isDevelopment) {
      segmentWriteKey = process.env.SNYK_VSCE_SEGMENT_WRITE_KEY ?? '';
    }

    const segment = new SegmentPlugin(segmentWriteKey);
    const isDevelopment = this.isDevelopment;

    itly.load({
      disabled: !this.shouldReportEvents,
      environment: isDevelopment ? 'development' : 'production',
      plugins: [segment, new ItlyErrorPlugin(this.logger)],
    });

    this.loaded = true;

    return this;
  }

  public flush = (): Promise<void> => itly.flush();

  public identify(userId: string): void {
    if (!this.canReportEvents()) {
      return;
    }

    this.userId = userId;

    // Calling identify again is the preferred way to merge authenticated user with anonymous one,
    // see https://snyk.slack.com/archives/C01U2SPRB3Q/p1624276750134700?thread_ts=1624030602.128900&cid=C01U2SPRB3Q
    itly.identify(this.userId, undefined, {
      segment: {
        options: {
          anonymousId: this.anonymousId,
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
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.issueInTreeIsClicked(this.userId, properties);
  }

  public logAnalysisIsReady(properties: AnalysisIsReadyProperties): void {
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.analysisIsReady(this.userId, properties);
  }

  public logAnalysisIsTriggered(properties: AnalysisIsTriggeredProperties): void {
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.analysisIsTriggered(this.userId, properties);
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
      {
        segment: {
          options: {
            anonymousId: this.anonymousId,
          },
        },
      },
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
            anonymousId: this.anonymousId,
          },
        },
      },
    );
  }

  public logPluginIsUninstalled(userId?: string): void {
    if (!userId) {
      userId = this.userId;
    }

    if (!this.canReportEvents() || !userId) {
      return;
    }

    itly.pluginIsUninstalled(userId, {
      ide: this.ide,
    });
  }

  public logQuickFixIsDisplayed(properties: QuickFixIsDisplayedProperties): void {
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.quickFixIsDisplayed(this.userId, properties);
  }

  public logIssueHoverIsDisplayed(properties: IssueHoverIsDisplayedProperties): void {
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.issueHoverIsDisplayed(this.userId, properties);
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
}
