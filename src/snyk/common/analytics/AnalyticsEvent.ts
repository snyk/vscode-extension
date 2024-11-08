import { AbstractAnalyticsEvent } from './AnalyticsSender';

export class AnalyticsEvent implements AbstractAnalyticsEvent {
  private readonly interactionType: string;
  private readonly category: string[];
  private readonly status: string;
  private readonly targetId: string;
  private readonly timestampMs: number;
  private readonly durationMs: number;
  private readonly results: Map<string, unknown>;
  private readonly errors: unknown[];
  private readonly extension: Map<string, unknown>;

  constructor(
    deviceId: string,
    interactionType: string,
    category: string[],
    status: string = 'success',
    targetId: string = 'pkg:filesystem/scrubbed',
    timestampMs: number = Date.now(),
    durationMs: number = 0,
    results: Map<string, unknown> = new Map<string, unknown>(),
    errors: unknown[] = [],
    extension: Map<string, unknown> = new Map<string, unknown>(),
  ) {
    this.interactionType = interactionType;
    this.category = category;
    this.status = status ?? 'success';
    this.targetId = targetId ?? 'pkg:filesystem/scrubbed';
    this.timestampMs = timestampMs ?? Date.now();
    this.durationMs = durationMs ?? 0;
    this.results = results ?? new Map<string, unknown>();
    this.errors = errors ?? [];
    this.extension = extension ?? new Map<string, unknown>();
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

  public getResults(): Map<string, unknown> {
    return this.results;
  }

  public getErrors(): unknown[] {
    return this.errors;
  }

  public getExtension(): Map<string, unknown> {
    return this.extension;
  }
}
