import path from 'path';

export class SnykConfiguration {
  readonly segmentWriteKey: string;
  readonly amplitudeExperimentApiKey: string;

  static get(extensionPath: string): Promise<SnykConfiguration> {
    return import(path.join(extensionPath, 'snyk.config.json')) as Promise<SnykConfiguration>;
  }
}
