import { EXECUTION_PAUSE_INTERVAL, EXECUTION_THROTTLING_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT, SNYK_MODE_CODES } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';

export class ScanModeService {
  private _mode = SNYK_MODE_CODES.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastThrottledExecution: number | undefined;

  constructor(private contextService: IContextService) {}

  isAutoScanAllowed(): boolean {
    if ([SNYK_MODE_CODES.MANUAL, SNYK_MODE_CODES.PAUSED].includes(this._mode) || this.shouldBeThrottled()) {
      return false;
    }

    return true;
  }

  async setMode(mode: string): Promise<void> {
    if (!Object.values(SNYK_MODE_CODES).includes(mode)) return;
    this._mode = mode;
    await this.contextService.setContext(SNYK_CONTEXT.MODE, mode);
    switch (mode) {
      case SNYK_MODE_CODES.PAUSED:
        this._unpauseTimeout = setTimeout(() => this.unpause(), EXECUTION_PAUSE_INTERVAL);
        break;
      case SNYK_MODE_CODES.AUTO:
      case SNYK_MODE_CODES.MANUAL:
      case SNYK_MODE_CODES.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
      default:
        break;
    }
  }

  private unpause(): void {
    if (this._mode === SNYK_MODE_CODES.PAUSED) void this.setMode(SNYK_MODE_CODES.AUTO);
  }

  private shouldBeThrottled(): boolean {
    if (this._mode !== SNYK_MODE_CODES.THROTTLED) return false;
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
