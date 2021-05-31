import { getSastSettings } from '../../api/cliConfig.service';
import { IConfiguration } from '../../configuration';
import { viewInBrowser } from '../../utils/vscodeCommandsUtils';

export interface ISnykCode {
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
}

export class SnykCode {
  /**
   *
   */
  constructor(private config: IConfiguration) {
  }

  public async isEnabled(): Promise<boolean> {
    // Code was disabled explicitly
    if (this.config.codeEnabled == false) {
      return false;
    }

    const settings = await getSastSettings();
    if (this.config.codeEnabled != settings.sastEnabled) {
      this.config.setCodeEnabled(settings.sastEnabled);
    }

    return settings.sastEnabled;
  }

  public async enable(): Promise<boolean> {
    let settings = await getSastSettings();
    if (settings.sastEnabled) {
      await this.config.setCodeEnabled(true);
      return true;
    }

    if (this.config.snykCodeUrl != null) {
      await viewInBrowser(this.config.snykCodeUrl);
    }

    // Poll for changed settings
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
