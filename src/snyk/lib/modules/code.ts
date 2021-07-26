import { IConfiguration } from '../../configuration';
import { getSastSettings } from '../../services/cliConfigService';
import { IOpenerService } from '../../services/openerService';

export interface ISnykCode {
  isAnalysisRunning: boolean;
  lastAnalysisDuration: number;
  lastAnalysisTimestamp: number;
  analysisStatus: string;
  analysisProgress: string;

  startAnalysis(): void;
  stopAnalysis(): void;
  finaliseAnalysis(): void;
  updateStatus(status: string, progress: string): void;
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
}

export class SnykCode implements ISnykCode {
  runningAnalysis = false;

  private lastAnalysisStartingTimestamp = Date.now();
  private _lastAnalysisDuration = 0;
  private _lastAnalysisTimestamp = Date.now();
  private _analysisStatus = '';
  private _analysisProgress = '';

  constructor(private config: IConfiguration, private openerService: IOpenerService) {}

  get isAnalysisRunning(): boolean {
    return this.runningAnalysis;
  }
  get lastAnalysisDuration(): number {
    return this._lastAnalysisDuration;
  }
  get lastAnalysisTimestamp(): number {
    return this._lastAnalysisTimestamp;
  }
  get analysisStatus(): string {
    return this._analysisStatus;
  }
  get analysisProgress(): string {
    return this._analysisProgress;
  }

  startAnalysis(): void {
    this.runningAnalysis = true;
    this.lastAnalysisStartingTimestamp = Date.now();
  }

  stopAnalysis(): void {
    this.runningAnalysis = false;
  }

  finaliseAnalysis(): void {
    this.runningAnalysis = false;
    this._lastAnalysisTimestamp = Date.now();
    this._lastAnalysisDuration = this._lastAnalysisTimestamp - this.lastAnalysisStartingTimestamp;
  }

  updateStatus(status: string, progress: string): void {
    this._analysisStatus = status;
    this._analysisProgress = progress;
  }

  async isEnabled(): Promise<boolean> {
    // Code was disabled explicitly
    if (this.config.codeEnabled === false) {
      return false;
    }

    const settings = await getSastSettings();
    if (this.config.codeEnabled !== settings.sastEnabled) {
      await this.config.setCodeEnabled(settings.sastEnabled);
    }

    return settings.sastEnabled;
  }

  async enable(): Promise<boolean> {
    let settings = await getSastSettings();
    if (settings.sastEnabled) {
      await this.config.setCodeEnabled(true);
      return true;
    }

    if (this.config.snykCodeUrl != null) {
      await this.openerService.openBrowserUrl(this.config.snykCodeUrl);
    }

    // Poll for changed settings (65 sec)
    for (let i = 2; i < 12; i += 1) {
      await this.sleep(i * 1000);

      settings = await getSastSettings();
      if (settings.sastEnabled) {
        await this.config.setCodeEnabled(true);
        return true;
      }
    }

    await this.config.setCodeEnabled(false);
    return false;
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
