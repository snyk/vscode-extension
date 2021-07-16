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
    const token = '17db2278-8d4c-4fb7-85c4-604721aa991b';
    await configuration.setToken(token);
    await configuration.setCodeEnabled(false);
    await configuration.setShouldReportEvents(false);

    strictEqual(configuration.token, token);
    strictEqual(configuration.codeEnabled, false);
    strictEqual(configuration.shouldReportEvents, false);
    await configuration.setToken('');
  });
});
