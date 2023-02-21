import { Subscription } from 'rxjs';
import { SNYK_CONTEXT } from '../../constants/views';
import { ExperimentKey, ExperimentService } from '../../experiment/services/experimentService';
import { ILog } from '../../logger/interfaces';
import { IContextService } from '../../services/contextService';
import { ILanguageServer } from '../languageServer';
import { CodeIssueData, Scan, ScanProduct, ScanStatus } from '../types';

export class CodeScanOrchestrator {
  private lastExperimentCheck: number;
  private lsSubscription: Subscription;
  private waitTimeInMs: number;

  constructor(
    private readonly experimentService: ExperimentService,
    readonly languageServer: ILanguageServer,
    private readonly logger: ILog,
    private readonly contextService: IContextService,
  ) {
    this.lastExperimentCheck = new Date().getTime();
    this.setWaitTimeInMs(1000 * 60 * 15); // 15 minutes
    this.lsSubscription = languageServer.scan$.subscribe(
      // todo: understand why eslint complains
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (scan: Scan<CodeIssueData>) => await this.handleExperimentCheck(scan),
    );
  }

  dispose(): void {
    this.lsSubscription.unsubscribe();
  }

  async handleExperimentCheck(scan: Scan<CodeIssueData>): Promise<void> {
    if (!this.isCheckRequired() || scan.status !== ScanStatus.InProgress || scan.product !== ScanProduct.Code) {
      return;
    }

    // check if the user's experiment has changed
    const isPartOfLSCodeExperiment = await this.experimentService.isUserPartOfExperiment(
      ExperimentKey.CodeScansViaLanguageServer,
      true,
    );

    if (isPartOfLSCodeExperiment) {
      // force restart of extension
      this.logger.debug('Restarting extension due to experiment change.');
      await this.contextService.setContext(SNYK_CONTEXT.LS_CODE_PREVIEW, false);
    }

    // update lastExperimentCheckTime
    this.lastExperimentCheck = new Date().getTime();
  }

  setWaitTimeInMs(ms: number) {
    this.waitTimeInMs = ms;
  }

  isCheckRequired(): boolean {
    const currentTimestamp = new Date().getTime();
    return currentTimestamp - this.lastExperimentCheck > this.waitTimeInMs;
  }
}
