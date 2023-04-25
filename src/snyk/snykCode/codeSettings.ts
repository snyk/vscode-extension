import { ISnykApiClient } from '../common/api/apiСlient';
import { IConfiguration } from '../common/configuration/configuration';
import { SNYK_CONTEXT } from '../common/constants/views';
import { IContextService } from '../common/services/contextService';
import { IOpenerService } from '../common/services/openerService';
import { IVSCodeCommands } from '../common/vscode/commands';
import { SNYK_CLI_CONFIG_SAST_ENABLED } from '../common/constants/commands';

export interface ICodeSettings {
  reportFalsePositivesEnabled: boolean;

  checkCodeEnabled(): Promise<boolean>;

  enable(): Promise<boolean>;

  getSastSettings(): Promise<boolean | undefined>;
}

export class CodeSettings implements ICodeSettings {
  private _reportFalsePositivesEnabled: boolean;

  get reportFalsePositivesEnabled(): boolean {
    return this._reportFalsePositivesEnabled;
  }

  constructor(
    private readonly snykApiClient: ISnykApiClient,
    private readonly contextService: IContextService,
    private readonly config: IConfiguration,
    private readonly openerService: IOpenerService,
    private readonly commandExecutor: IVSCodeCommands,
  ) {}

  async checkCodeEnabled(): Promise<boolean> {
    const enabled = await this.getSastSettings();
    await this.contextService.setContext(SNYK_CONTEXT.CODE_ENABLED, enabled);

    return enabled ?? false;
  }

  async enable(): Promise<boolean> {
    let enabled = await this.getSastSettings();
    if (enabled) {
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
      enabled = await this.getSastSettings();
      if (enabled) {
        return true;
      }
    }

    return false;
  }

  async getSastSettings(): Promise<boolean | undefined> {
    return this.commandExecutor.executeCommand(SNYK_CLI_CONFIG_SAST_ENABLED);
  }

  private sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));
}
