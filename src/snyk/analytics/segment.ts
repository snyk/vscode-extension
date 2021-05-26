import { v4 as uuidv4 } from 'uuid';

export class Segment {
  private analyticsCollectionEnabled: boolean;
  private readonly anonymousId: string;
  private analytics: any;
  private userId: string;

  constructor() {
    try {
      const { segmentWriteKey } = require('../../../snyk.config.json');
      if (!segmentWriteKey) {
        this.analyticsCollectionEnabled = false;
        console.log('Segment analytics collection is disabled because write key is empty!');
      } else {
        const Analytics = require('analytics-node');
        this.analytics = new Analytics(segmentWriteKey, {
          flushAt: 5,
          flushInterval: 10000,
        });
        this.anonymousId = uuidv4();
        this.analyticsCollectionEnabled = true;
      }
    } catch (err) {
      this.analyticsCollectionEnabled = false;
      console.log('Failed to create Segment analytics. Event collection is disabled.');
      console.log(err);
    }
  }

  shutdown(): void {
    this.analytics?.flush();
    this.analytics?.shutdown();
  }

  setAnalyticsCollectionEnabled(enabled: boolean): void {
    this.analyticsCollectionEnabled = enabled;
  }

  private setUserId(userId: string): void {
    this.userId = userId;
  }

  identify(): void {
    if (!this.analyticsCollectionEnabled) return;

    this.analytics?.identify({
      anonymousId: this.anonymousId,
      traits: {
        ide: 'Visual Studio Code',
      },
    });
  }

  alias(userId: string): void {
    if (!this.analyticsCollectionEnabled) return;

    this.setUserId(userId);
    this.analytics?.alias({
      previousId: this.anonymousId,
      userId: this.userId,
    });
  }

  logEvent(event: string, properties?: Object): void {
    if (!this.analyticsCollectionEnabled) return;

    if (this.userId) {
      this.analytics?.track({
        event: event,
        properties: properties,
        userId: this.userId,
      });
    } else {
      this.analytics?.track({
        anonymousId: this.anonymousId,
        event: event,
        properties: properties,
      });
    }
  }
}
