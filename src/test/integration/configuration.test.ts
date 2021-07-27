import { strictEqual } from 'assert';
import { configuration } from '../../snyk/configuration';

suite('Configuration', () => {
  test('configuration constants differ between DEV and PROD', () => {
    process.env.SNYK_VSCE_DEVELOPMENT = '';
    strictEqual(configuration.baseURL, 'https://deeproxy.snyk.io');
    strictEqual(configuration.authHost, 'https://snyk.io');

    process.env.SNYK_VSCE_DEVELOPMENT = '1';
    strictEqual(configuration.baseURL, 'https://deeproxy.dev.snyk.io');
    strictEqual(configuration.authHost, 'https://dev.snyk.io');
  });

  test('configuration change is reflected', async () => {
    const token = 'fake-token';
    const featuresConfig = {
      codeSecurityEnabled: true,
      codeQualityEnabled: false,
    };

    await configuration.setToken(token);
    await configuration.setFeaturesConfiguration(featuresConfig);
    await configuration.setShouldReportEvents(false);

    strictEqual(configuration.token, token);
    strictEqual(configuration.getFeaturesConfiguration(), featuresConfig);
    strictEqual(configuration.shouldReportEvents, false);
    await configuration.setToken('');
  });
});
