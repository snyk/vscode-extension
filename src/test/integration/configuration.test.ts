import { strictEqual } from 'assert';
import { configuration } from '../../snyk/common/configuration/instance';
import vscode from 'vscode';
import { ADVANCED_CUSTOM_ENDPOINT } from '../../snyk/common/constants/settings';

suite('Configuration', () => {
  test('settings change is reflected', async () => {
    // customEndpoint has machine scope, so it must be written to Global (User) settings
    await vscode.workspace.getConfiguration().update(ADVANCED_CUSTOM_ENDPOINT, '', vscode.ConfigurationTarget.Global);
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace
      .getConfiguration()
      .update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.snyk.io', vscode.ConfigurationTarget.Global);
    strictEqual(configuration.snykCodeUrl, 'https://app.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.snyk.io');

    await vscode.workspace
      .getConfiguration()
      .update(ADVANCED_CUSTOM_ENDPOINT, 'https://api.dev.snyk.io', vscode.ConfigurationTarget.Global);
    strictEqual(configuration.snykCodeUrl, 'https://app.dev.snyk.io/manage/snyk-code?from=vscode');
    strictEqual(configuration.authHost, 'https://app.dev.snyk.io');
  });
});
