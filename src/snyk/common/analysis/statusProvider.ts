export class AnalysisStatusProvider {
  private runningAnalysis = false;

  private lastAnalysisStartingTimestamp = Date.now();
  private _lastAnalysisDuration = 0;
  private _lastAnalysisTimestamp = Date.now();

  private _isLsDownloadSuccessful = true;

  get isAnalysisRunning(): boolean {
    return this.runningAnalysis;
  }
  get lastAnalysisDuration(): number {
    return this._lastAnalysisDuration;
  }
  get lastAnalysisTimestamp(): number {
    return this._lastAnalysisTimestamp;
  }

  get isLsDownloadSuccessful(): boolean {
    return this._isLsDownloadSuccessful;
  }

  handleLsDownloadFailure(): void {
    this._isLsDownloadSuccessful = false;
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
