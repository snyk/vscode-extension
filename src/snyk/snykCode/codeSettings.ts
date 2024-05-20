import { IConfiguration } from '../common/configuration/configuration';
import { SNYK_GET_SETTINGS_SAST_ENABLED } from '../common/constants/commands';
import { SNYK_CONTEXT } from '../common/constants/views';
import { IContextService } from '../common/services/contextService';
import { IOpenerService } from '../common/services/openerService';
import { IVSCodeCommands } from '../common/vscode/commands';

export interface ICodeSettings {
  updateIsCodeEnabled(): Promise<boolean>;

  enable(): Promise<boolean>;

  getSastSettings(): Promise<SastSettings | undefined>;
}

type SastSettings = {
  sastEnabled: boolean;
  localCodeEngine: {
    enabled: boolean;
  };
};

export class CodeSettings implements ICodeSettings {
  constructor(
    private readonly contextService: IContextService,
    private readonly config: IConfiguration,
    private readonly openerService: IOpenerService,
    private readonly commandExecutor: IVSCodeCommands,
  ) {}

  async updateIsCodeEnabled(settings: SastSettings | undefined = undefined): Promise<boolean> {
    let codeEnabled = false;
    let localCodeEngineEnabled = false;
    try {
      settings = settings === undefined ? await this.getSastSettings() : settings;
      if (!settings) {
        return false;
      }
      codeEnabled = settings.sastEnabled;
      localCodeEngineEnabled = settings.localCodeEngine.enabled;
    } catch (e) {
      return false;
    }
    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, codeEnabled);
    await this.contextService.setContext(SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED, localCodeEngineEnabled);

    return codeEnabled;
  }

  async enable(openBrowser = true): Promise<boolean> {
    let settings: SastSettings | undefined;
    try {
      settings = await this.getSastSettings();
      await this.updateIsCodeEnabled(settings);
    } catch (e) {
      if (e instanceof Error) {
        // Ignore potential command not found error during LS startup
      }
    }

    if (settings?.sastEnabled) {
      return true;
    }

    if (this.config.snykCodeUrl != null && openBrowser) {
      await this.openerService.openBrowserUrl(this.config.snykCodeUrl);
    }

    // Poll for changed settings (65 sec)
    for (let i = 2; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.sleep(i * 1000);

      try {
        // eslint-disable-next-line no-await-in-loop
        settings = await this.getSastSettings();
        if (settings?.sastEnabled && !settings?.localCodeEngine.enabled) {
          // eslint-disable-next-line no-await-in-loop
          await this.updateIsCodeEnabled(settings);
          return true;
        }
      } catch (e) {
        // Ignore potential command not found error during LS startup
      }
    }

    return false;
  }

  async getSastSettings(): Promise<SastSettings | undefined> {
    return this.commandExecutor.executeCommand<SastSettings>(SNYK_GET_SETTINGS_SAST_ENABLED);
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
