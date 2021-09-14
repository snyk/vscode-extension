import { IConfiguration } from '../../common/configuration/configuration';
import { EXECUTION_PAUSE_INTERVAL, EXECUTION_THROTTLING_INTERVAL } from '../../common/constants/general';
import { SNYK_CONTEXT } from '../../common/constants/views';
import { IContextService } from '../../common/services/contextService';
import { CODE_SCAN_MODE } from '../../snykCode/constants/modes';

export class ScanModeService {
  private _mode = CODE_SCAN_MODE.AUTO;
  // Platform-independant type definition.
  private _unpauseTimeout: ReturnType<typeof setTimeout> | undefined;
  private _lastThrottledExecution: number | undefined;

  constructor(private contextService: IContextService, private config: IConfiguration) {}

  isOssAutoScanAllowed(): boolean {
    return this.config.shouldAutoScanOss;
  }

  isCodeAutoScanAllowed(): boolean {
    if (
      [CODE_SCAN_MODE.MANUAL, CODE_SCAN_MODE.PAUSED].includes(this._mode) ||
      this.shouldCodeBeThrottled()
    ) {
      return false;
    }

    return true;
  }

  async setCodeMode(mode: string): Promise<void> {
    if (!Object.values(CODE_SCAN_MODE).includes(mode)) return;
    this._mode = mode;
    await this.contextService.setContext(SNYK_CONTEXT.MODE, mode);
    switch (mode) {
      case CODE_SCAN_MODE.PAUSED:
        this._unpauseTimeout = setTimeout(() => this.unpauseCode(), EXECUTION_PAUSE_INTERVAL);
        break;
      case CODE_SCAN_MODE.AUTO:
      case CODE_SCAN_MODE.MANUAL:
      case CODE_SCAN_MODE.THROTTLED:
        if (this._unpauseTimeout) clearTimeout(this._unpauseTimeout);
        break;
      default:
        break;
    }
  }

  private unpauseCode(): void {
    if (this._mode === CODE_SCAN_MODE.PAUSED) void this.setCodeMode(CODE_SCAN_MODE.AUTO);
  }

  private shouldCodeBeThrottled(): boolean {
    if (this._mode !== CODE_SCAN_MODE.THROTTLED) return false;
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
