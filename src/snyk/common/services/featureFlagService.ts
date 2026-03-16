import { IVSCodeCommands } from '../vscode/commands';
import { FeatureFlagStatus } from '../types';
import { SNYK_FEATURE_FLAG_COMMAND } from '../constants/commands';
import { ILog } from '../logger/interfaces';

export class FeatureFlagService {
  constructor(private commandExecutor: IVSCodeCommands, private logger: ILog) {}

  async fetchFeatureFlag(flagName: string, fallbackValue = false): Promise<boolean> {
    try {
      const ffStatus = await this.commandExecutor.executeCommand<FeatureFlagStatus>(
        SNYK_FEATURE_FLAG_COMMAND,
        flagName,
      );
      this.logger.info(`[FeatureFlagService] ${flagName} is ${ffStatus?.ok ? 'enabled' : 'disabled'}`);
      return ffStatus?.ok ?? false;
    } catch (error) {
      this.logger.warn(`[FeatureFlagService] Failed to fetch feature flag ${flagName}, defaulting to ${fallbackValue}: ${error}`);
      return fallbackValue;
    }
  }
}
