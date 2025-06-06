import { deepStrictEqual, strictEqual } from 'assert';
import { FeaturesConfiguration } from '../../snyk/common/configuration/configuration';
import { configuration } from '../../snyk/common/configuration/instance';
import vscode from 'vscode';
import { ADVANCED_CUSTOM_ENDPOINT } from '../../snyk/common/constants/settings';

suite('Configuration', () => {
  test('settings change is reflected', async () => {
    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, '');
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.snyk.io');
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.dev.snyk.io');
    strictEqual(configuration.snykCodeUrl, 'https://app.dev.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.dev.snyk.io');
  });

  test('configuration change is reflected', async () => {
    try {
      const featuresConfig = {
        ossEnabled: false,
        codeSecurityEnabled: false,
        iacEnabled: false,
      } as FeaturesConfiguration;

      await configuration.setFeaturesConfiguration(featuresConfig);

      deepStrictEqual(configuration.getFeaturesConfiguration(), featuresConfig);
    } finally {
      await configuration.setToken('');

      await configuration.setFeaturesConfiguration(undefined);
      const defaultConfig = configuration.getFeaturesConfiguration();
      deepStrictEqual(defaultConfig, {
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
      });

      const enabledFeaturesConfig = {
        ossEnabled: true,
        codeSecurityEnabled: true,
        iacEnabled: true,
      } as FeaturesConfiguration;
      await configuration.setFeaturesConfiguration(enabledFeaturesConfig);
    }
  });
});
