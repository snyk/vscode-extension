import { IVSCodeCommands } from '../vscode/commands';
import { FeatureFlagStatus } from '../types';
import { SNYK_FEATURE_FLAG_COMMAND } from '../constants/commands';

export class FeatureFlagService {
  constructor(private commandExecutor: IVSCodeCommands) {}

  async fetchFeatureFlag(flagName: string, fallbackValue = false): Promise<boolean> {
    try {
      const ffStatus = await this.commandExecutor.executeCommand<FeatureFlagStatus>(
        SNYK_FEATURE_FLAG_COMMAND,
        flagName,
      );
      console.log(`[FeatureFlagService] ${flagName} is ${ffStatus?.ok ? 'enabled' : 'disabled'}`);
      return ffStatus?.ok ?? false;
    } catch (error) {
      console.warn(`[FeatureFlagService] Failed to fetch feature flag ${flagName}: ${error}`);
      return fallbackValue;
    }
  }
}
