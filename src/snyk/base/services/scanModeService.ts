import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { EXECUTION_PAUSE_INTERVAL, EXECUTION_THROTTLING_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { CodeScanMode } from '../../snykCode/constants/modes';

export class ScanModeService {
  private _mode = CodeScanMode.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastThrottledExecution: number | undefined;

  constructor(private contextService: IContextService, private config: IConfiguration, private analytics: IAnalytics) {}

  isOssAutoScanAllowed(): boolean {
    return this.config.shouldAutoScanOss;
  }

  isCodeAutoScanAllowed(): boolean {
    if ([CodeScanMode.MANUAL, CodeScanMode.PAUSED].includes(this._mode) || this.shouldCodeBeThrottled()) {
      return false;
    }

    return true;
  }

  async setCodeMode(mode: CodeScanMode): Promise<void> {
    if (!Object.values(CodeScanMode).includes(mode)) return;
    this._mode = mode;
    await this.contextService.setContext(SNYK_CONTEXT.MODE, mode);
    switch (mode) {
      case CodeScanMode.PAUSED:
        this._unpauseTimeout = setTimeout(() => this.unpauseCode(), EXECUTION_PAUSE_INTERVAL);
        break;
      case CodeScanMode.AUTO:
      case CodeScanMode.MANUAL:
      case CodeScanMode.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
      default:
        break;
    }

    this.analytics.logScanModeIsSelected({
      scanMode: mode,
    });
  }

  private unpauseCode(): void {
    if (this._mode === CodeScanMode.PAUSED) void this.setCodeMode(CodeScanMode.AUTO);
  }

  private shouldCodeBeThrottled(): boolean {
    if (this._mode !== CodeScanMode.THROTTLED) return false;
    const now = Date.now();
    if (
      this._lastThrottledExecution === undefined ||
      now - this._lastThrottledExecution >= EXECUTION_THROTTLING_INTERVAL
    ) {
      this._lastThrottledExecution = now;
      return false;
    }
    return true;
  }
}
