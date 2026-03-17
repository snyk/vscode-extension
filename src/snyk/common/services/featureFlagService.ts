import { IVSCodeCommands } from '../vscode/commands';
import { FeatureFlagStatus } from '../types';
import { SNYK_FEATURE_FLAG_COMMAND } from '../constants/commands';
import { ILog } from '../logger/interfaces';

export class FeatureFlagService {
  private readonly classLogger;

  constructor(private readonly commandExecutor: IVSCodeCommands, logger: ILog) {
    this.classLogger = logger.classLog(FeatureFlagService.name);
  }

  async fetchFeatureFlag(flagName: string, fallbackValue = false): Promise<boolean> {
    const funcLogger = this.classLogger.funcLog(this.fetchFeatureFlag.name);
    try {
      const ffStatus = await this.commandExecutor.executeCommand<FeatureFlagStatus>(
        SNYK_FEATURE_FLAG_COMMAND,
        flagName,
      );
      funcLogger.info(`${flagName} is ${ffStatus?.ok ? 'enabled' : 'disabled'}`);
      return ffStatus?.ok ?? false;
    } catch (error) {
      funcLogger.warn(`Failed to fetch feature flag ${flagName}, defaulting to ${fallbackValue}: ${error}`);
      return fallbackValue;
    }
  }
}
