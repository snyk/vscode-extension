// import { Subscription } from 'rxjs';
// import { ExperimentKey, ExperimentService } from '../../experiment/services/experimentService';
// import { ILanguageServer } from '../languageServer';
// import { CodeIssueData, Scan } from '../types';

// class CodeScanOrchestrator {
//   private lastScanTime: number;
//   private waitTimeInterval: number;
//   private lsSubscription: Subscription;

//   constructor(private experimentService: ExperimentService, private languageServer: ILanguageServer) {
//     this.waitTimeInterval = 1000 * 60 * 5; // 5 minutes
//     this.lastScanTime = new Date().getTime();
//     this.lsSubscription = languageServer.scan$.subscribe((scan: Scan<CodeIssueData>) =>
//       this.handleExperimentCheck(scan),
//     );
//   }

//   async handleExperimentCheck(scan: Scan<CodeIssueData>) {
//     // check if 5 minutes have passed
//     if (!this.timeIntervalCheck()) {
//       return;
//     }

//     // check if the user's experiment has changed
//     const isPartOfLSCodeExperiment = await this.experimentService.isUserPartOfExperiment(
//       ExperimentKey.CodeScansViaLanguageServer,
//     );
//     // force restart of extension

//     // update lastScanTime
//   }

//   private timeIntervalCheck(): boolean {
//     const currentTimestamp = new Date().getTime();
//     return currentTimestamp - this.lastScanTime > this.waitTimeInterval;
//   }
// }
