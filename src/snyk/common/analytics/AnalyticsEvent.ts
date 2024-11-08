import { AbstractAnalyticsEvent } from './AnalyticsSender';

export class AnalyticsEvent implements AbstractAnalyticsEvent {
  private readonly interactionType: string;
  private readonly category: string[];
  private readonly status: string;
  private readonly targetId: string;
  private readonly timestampMs: number;
  private readonly durationMs: number;
  private readonly results: Map<string, any>;
  private readonly errors: any[];
  private readonly extension: Map<string, any>;

  constructor(
    deviceId: string,
    interactionType: string,
    category: string[],
    status: string = 'success',
    targetId: string = 'pkg:filesystem/scrubbed',
    timestampMs: number = Date.now(),
    durationMs: number = 0,
    results: Map<string, any> = new Map<string, any>(),
    errors: any[] = [],
    extension: Map<string, any> = new Map<string, any>(),
  ) {
    this.interactionType = interactionType;
    this.category = category;
    this.status = status ?? 'success';
    this.targetId = targetId ?? 'pkg:filesystem/scrubbed';
    this.timestampMs = timestampMs ?? Date.now();
    this.durationMs = durationMs ?? 0;
    this.results = results ?? new Map<string, any>();
    this.errors = errors ?? [];
    this.extension = extension ?? new Map<string, any>();
    if (deviceId && deviceId.length > 0) {
      this.extension.set('device_id', deviceId);
    }
  }

  public getInteractionType(): string {
    return this.interactionType;
  }

  public getCategory(): string[] {
    return this.category;
  }

  public getStatus(): string {
    return this.status;
  }

  public getTargetId(): string {
    return this.targetId;
  }

  public getTimestampMs(): number {
    return this.timestampMs;
  }

  public getDurationMs(): number {
    return this.durationMs;
  }

  public getResults(): Map<string, any> {
    return this.results;
  }

  public getErrors(): any[] {
    return this.errors;
  }

  public getExtension(): Map<string, any> {
    return this.extension;
  }
}
