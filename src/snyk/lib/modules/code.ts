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
    viewInBrowser(configuration.snykCodeUrl);

    for (let i = 1; i < 10; i += 1) {
      await this.sleep(i*1000);

      const settings = await getSastSettings();
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

