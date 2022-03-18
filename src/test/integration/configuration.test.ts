import { deepStrictEqual, strictEqual } from 'assert';
import { FeaturesConfiguration } from '../../snyk/common/configuration/configuration';
import { configuration } from '../../snyk/common/configuration/instance';

suite('Configuration', () => {
  test('configuration constants differ between DEV and PROD', () => {
    process.env.SNYK_VSCE_DEVELOPMENT = '';
    strictEqual(configuration.snykCodeBaseURL, 'https://deeproxy.snyk.io');
    strictEqual(configuration.authHost, 'https://snyk.io');

    process.env.SNYK_VSCE_DEVELOPMENT = '1';
    strictEqual(configuration.snykCodeBaseURL, 'https://deeproxy.dev.snyk.io');
    strictEqual(configuration.authHost, 'https://dev.snyk.io');
  });

  test('configuration change is reflected', async () => {
    const token = 'fake-token';
    const featuresConfig = {
      ossEnabled: true,
      codeSecurityEnabled: true,
      codeQualityEnabled: false,
    } as FeaturesConfiguration;

    await configuration.setToken(token);
    await configuration.setFeaturesConfiguration(featuresConfig);
    await configuration.setShouldReportEvents(false);

    strictEqual(await configuration.getToken(), token);
    deepStrictEqual(configuration.getFeaturesConfiguration(), featuresConfig);
    strictEqual(configuration.shouldReportEvents, false);
    await configuration.setToken('');
  });
});
