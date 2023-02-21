import { Subscription } from 'rxjs';
import { ExperimentKey, ExperimentService } from '../../experiment/services/experimentService';
import { ILog } from '../../logger/interfaces';
import { ILanguageServer } from '../languageServer';
import { CodeIssueData, Scan, ScanProduct, ScanStatus } from '../types';

export class CodeScanOrchestrator {
  private lastExperimentCheck: number;
  private lsSubscription: Subscription;

  constructor(
    private experimentService: ExperimentService,
    readonly languageServer: ILanguageServer,
    private readonly logger: ILog,
  ) {
    this.lastExperimentCheck = new Date().getTime();
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
    if (this.minutesSinceLastCheck(5) || scan.status !== ScanStatus.InProgress || scan.product !== ScanProduct.Code) {
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
    }

    // update lastExperimentCheckTime
    this.lastExperimentCheck = new Date().getTime();
  }

  private setWaitTimeInMinutes(minutes: number): number {
    return 1000 * 60 * minutes;
  }

  private minutesSinceLastCheck(minutes: number): boolean {
    const currentTimestamp = new Date().getTime();
    return currentTimestamp - this.lastExperimentCheck > this.setWaitTimeInMinutes(minutes);
  }
}
