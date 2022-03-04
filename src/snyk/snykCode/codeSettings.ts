import { ISnykApiClient } from '../common/api/apiСlient';
import { IConfiguration } from '../common/configuration/configuration';
import { SNYK_CONTEXT } from '../common/constants/views';
import { getSastSettings, SastSettings } from '../common/services/cliConfigService';
import { IContextService } from '../common/services/contextService';
import { IOpenerService } from '../common/services/openerService';

export interface ICodeSettings {
  checkCodeEnabled(): Promise<boolean>;
  enable(): Promise<boolean>;
}

export class CodeSettings implements ICodeSettings {
  constructor(
    private readonly snykApiClient: ISnykApiClient,
    private readonly contextService: IContextService,
    private readonly config: IConfiguration,
    private readonly openerService: IOpenerService,
  ) {}

  async checkCodeEnabled(): Promise<boolean> {
    const settings = await this.getSastSettings();
    if (!settings) {
      return false;
    }

    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, settings.sastEnabled);
    await this.contextService.setContext(
      SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED,
      settings.localCodeEngine.enabled ?? false,
    );

    return settings.sastEnabled && !settings.localCodeEngine.enabled;
  }

  async enable(): Promise<boolean> {
    let settings = await this.getSastSettings();
    if (settings?.sastEnabled) {
      return true;
    }

    if (this.config.snykCodeUrl != null) {
      await this.openerService.openBrowserUrl(this.config.snykCodeUrl);
    }

    // Poll for changed settings (65 sec)
    for (let i = 2; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(i * 1000);

      // eslint-disable-next-line no-await-in-loop
      settings = await this.getSastSettings();
      if (settings?.sastEnabled) {
        return true;
      }
    }

    return false;
  }

  getSastSettings(): Promise<SastSettings | undefined> {
    return getSastSettings(this.snykApiClient);
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
