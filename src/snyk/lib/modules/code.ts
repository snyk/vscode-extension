import { getSastSettings } from '../../api/cliConfig.service';
import { configuration } from '../../configuration';
import { viewInBrowser } from '../../utils/vscodeCommandsUtils';

export interface ISnykCode {
  isEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
}

export class SnykCode {
  public async isEnabled(): Promise<boolean> {
    // Code was disabled explicitly
    if (configuration.codeEnabled == false) {
      return false;
    }

    const settings = await getSastSettings();
    configuration.setCodeEnabled(settings.sastEnabled);

    return settings.sastEnabled;
  }

  public async enable(): Promise<boolean> {
    let settings = await getSastSettings();
    if (settings.sastEnabled) {
      await configuration.setCodeEnabled(true);
      return true;
    }

    if (configuration.snykCodeUrl != null) {
      await viewInBrowser(configuration.snykCodeUrl);
    }

    // Poll for changed settings
    for (let i = 2; i < 12; i += 1) {
      await this.sleep(i * 1000);

      settings = await getSastSettings();
      if (settings.sastEnabled) {
        await configuration.setCodeEnabled(true);
        return true;
      }
    }

    await configuration.setCodeEnabled(false);
    return false;
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
