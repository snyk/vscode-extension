/* eslint-disable @typescript-eslint/no-var-requires */
import SegmentPlugin from '@itly/plugin-segment-node';
import { v4 as uuidv4 } from 'uuid';
import { ILog } from '../../interfaces/loggerInterface';
import itly, {
  AnalysisIsReadyProperties,
  AnalysisIsTriggeredProperties as _AnalysisIsTriggeredProperties,
  IssueIsViewedProperties,
} from '../../itly';
import { ItlyErrorPlugin } from './itlyErrorPlugin';

export type SupportedAnalysisProperties =
  | 'Snyk Advisor'
  | 'Snyk Code Quality'
  | 'Snyk Code Security'
  | 'Snyk Open Source';
export type AnalysisIsTriggeredProperties = _AnalysisIsTriggeredProperties & {
  analysisType: SupportedAnalysisProperties[];
};

/**
 * Do not have any dependencies on 'vscode' module to prevent uninstall hook from breaking.
 * Import required dependencies dynamically, if needed.
 */
export class Iteratively {
  private readonly ide = 'Visual Studio Code';
  private readonly anonymousId: string;
  private loaded = false;
  private userId: string;

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

    let { segmentWriteKey } = require('../../../snyk.config.json') as { segmentWriteKey: string };
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

    const { version } = require('../../../package.json') as { version: string };

    // Calling identify again is the preferred way to merge authenticated user with anonymous one,
    // see https://snyk.slack.com/archives/C01U2SPRB3Q/p1624276750134700?thread_ts=1624030602.128900&cid=C01U2SPRB3Q
    itly.identify(this.userId, undefined, {
      segment: {
        options: {
          anonymousId: this.anonymousId,
          context: {
            app: {
              name: this.ide,
              version,
            },
          },
        },
      },
    });
  }

  public logIssueIsViewed(properties: IssueIsViewedProperties): void {
    if (!this.canReportEvents() || !this.userId) {
      return;
    }

    itly.issueIsViewed(this.userId, properties);
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
