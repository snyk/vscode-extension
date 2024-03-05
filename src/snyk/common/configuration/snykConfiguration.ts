import path from 'path';

export class SnykConfiguration {
  private static readonly configFileName = 'snyk.config.json';
  private static readonly localConfigFileName = 'snyk.config.local.json';

  readonly amplitudeExperimentApiKey: string;
  readonly sentryKey: string;

  constructor(amplitudeExperimentApiKey: string, sentryKey: string) {
    this.amplitudeExperimentApiKey = amplitudeExperimentApiKey;
    this.sentryKey = sentryKey;
  }

  static get(extensionPath: string, isDevelopment: boolean): Promise<SnykConfiguration> {
    const configFilename = isDevelopment ? this.localConfigFileName : this.configFileName;
    return import(path.join(extensionPath, configFilename)) as Promise<SnykConfiguration>;
  }
}
