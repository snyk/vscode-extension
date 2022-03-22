import { Experiment, ExperimentClient, Variants } from '@amplitude/experiment-node-server';
import { IConfiguration } from '../../configuration/configuration';
import { SnykConfiguration } from '../../configuration/snykConfiguration';
import { ILog } from '../../logger/interfaces';
import { User } from '../../user';

export enum ExperimentKey {
  // to be populated with running experiment keys
  TestExperiment = 'vscode-test-experiment',
}

export class ExperimentService {
  private client: ExperimentClient;
  private variants?: Variants;

  constructor(
    private readonly user: User,
    private readonly logger: ILog,
    private readonly configuration: IConfiguration,
    private readonly snykConfiguration?: SnykConfiguration,
  ) {}

  load(): boolean {
    if (!this.canExperiment) {
      return false;
    }

    const amplitudeExperimentApiKey = this.snykConfiguration?.amplitudeExperimentApiKey;
    if (!amplitudeExperimentApiKey) {
      this.logger.debug('Segment analytics write key is empty. No analytics will be collected.');
      return false;
    }

    this.client = Experiment.initialize(amplitudeExperimentApiKey);
    return true;
  }

  async isUserPartOfExperiment(variantFlag: ExperimentKey): Promise<boolean> {
    if (!this.canExperiment) {
      return false;
    }

    const variants = await this.fetchVariants();
    const variant = variants[variantFlag];
    if (variant?.value === 'test') {
      return true;
    }

    return false;
  }

  private async fetchVariants(): Promise<Variants> {
    if (!this.variants) {
      try {
        this.variants = await this.client.fetch({
          /* eslint-disable camelcase */
          user_id: this.user.authenticatedId,
          device_id: this.user.anonymousId,
          /* eslint-enable camelcase */
        });
      } catch (err) {
        this.logger.warn(`Experiment variants fetch failed. ${err}`);
        this.variants = {};
      }
    }

    return this.variants;
  }

  private canExperiment = this.configuration.shouldReportEvents;
}
