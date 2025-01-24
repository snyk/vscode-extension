import { ILog } from '../../common/logger/interfaces';
import { SummaryWebviewViewProvider } from '../../common/views/summaryWebviewProvider';

export interface ISummaryProviderService {
  updateSummaryPanel(scanSummary: string): void;
}

export class SummaryProviderService implements ISummaryProviderService {
  constructor(
    private readonly logger: ILog,
    private readonly summaryWebviewViewProvider: SummaryWebviewViewProvider | undefined,
  ) {}
  public updateSummaryPanel(scanSummary: string) {
    if (!this.summaryWebviewViewProvider) {
      this.logger.error('Summary Webview Provider was not initialized.');
      return;
    }
    try {
      this.summaryWebviewViewProvider.updateWebviewContent(scanSummary);
    } catch (error) {
      this.logger.error('Failed to update Summary panel');
    }
  }
}
