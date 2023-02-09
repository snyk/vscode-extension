import { IAnalytics } from '../../common/analytics/itly';
import { IConfiguration } from '../../common/configuration/configuration';
import { IContextService } from '../../common/services/contextService';
import { CodeScanMode } from '../../snykCode/constants/modes';

export class ScanModeService {
  private _mode = CodeScanMode.AUTO;
  private _lastThrottledExecution: number | undefined;

  constructor(private contextService: IContextService, private config: IConfiguration, private analytics: IAnalytics) {}

  isOssAutoScanAllowed(): boolean {
    return this.config.shouldAutoScanOss;
  }

  isCodeAutoScanAllowed(): boolean {
    return true;
  }
}
