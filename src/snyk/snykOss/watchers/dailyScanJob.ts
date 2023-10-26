import { IExtension } from '../../base/modules/interfaces';

export class DailyScanJob {
  private readonly dayInMs = 86400000;
  private job: NodeJS.Timeout;

  constructor(private readonly extension: IExtension) {}

  schedule(): void {
    if (this.job) {
      this.job.refresh();
      return;
    }

    this.job = setTimeout(() => {
      void this.extension.runOssScan(false);
    }, this.dayInMs);
  }
}
