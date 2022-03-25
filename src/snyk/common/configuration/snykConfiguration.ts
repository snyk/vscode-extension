import pJson from '../../../../snyk.config.local.json';

export class SnykConfiguration {
  private static readonly configFileName = 'snyk.config.json';
  private static readonly localConfigFileName = 'snyk.config.local.json';

  readonly segmentWriteKey: string;
  readonly amplitudeExperimentApiKey: string;
  readonly sentryKey: string;

  static get(extensionPath: string, isDevelopment: boolean): Promise<SnykConfiguration> {
    const configFilename = isDevelopment ? this.localConfigFileName : this.configFileName;
    return Promise.resolve(pJson) as Promise<SnykConfiguration>;
  }
}
