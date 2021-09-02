export class AnalysisStatusProvider {
  private runningAnalysis = false;

  private lastAnalysisStartingTimestamp = Date.now();
  private _lastAnalysisDuration = 0;
  private _lastAnalysisTimestamp = Date.now();

  get isAnalysisRunning(): boolean {
    return this.runningAnalysis;
  }
  get lastAnalysisDuration(): number {
    return this._lastAnalysisDuration;
  }
  get lastAnalysisTimestamp(): number {
    return this._lastAnalysisTimestamp;
  }

  analysisStarted(): void {
    this.runningAnalysis = true;
    this.lastAnalysisStartingTimestamp = Date.now();
  }

  analysisFinished(): void {
    this.runningAnalysis = false;
    this._lastAnalysisTimestamp = Date.now();
    this._lastAnalysisDuration = this._lastAnalysisTimestamp - this.lastAnalysisStartingTimestamp;
  }
}
