import assert from 'assert';
import sinon from 'sinon';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import { ClientSettings, ServerSettings } from '../../../../snyk/common/languageServer/settings';
import {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  ResponseError,
} from '../../../../snyk/common/vscode/types';

suite('Language Server: Middleware', () => {
  let clientSettings: ClientSettings;
  setup(() => {
    clientSettings = {
      yesCrashReport: true,
      yesTelemetry: true,
      yesWelcomeNotification: false,
      yesBackgroundOssNotification: true,
      advanced: {
        advancedMode: false,
        autoScanOpenSourceSecurity: true,
        additionalParameters: '',
        customEndpoint: '',
        organization: '',
        tokenStorage: "Always use VS Code's secret storage",
        automaticDependencyManagement: false,
        cliPath: '',
      },
      features: {
        openSourceSecurity: false,
        codeSecurity: true,
        codeQuality: false,
        preview: {
          reportFalsePositives: true,
          lsAuthenticate: true,
        },
      },
      severity: {
        critical: true,
        high: true,
        medium: true,
        low: true,
      },
    };
  });

  teardown(() => {
    sinon.restore();
  });

  test('Configuration request should translate settings', async () => {
    const middleware = new LanguageClientMiddleware();
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return [clientSettings];
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (res instanceof Error) {
      assert.fail('Handler returned an error');
    }

    const serverResult = res[0] as ServerSettings;
    assert.strictEqual(serverResult.activateSnykCode, 'false');
    assert.strictEqual(serverResult.activateSnykOpenSource, 'false');
    assert.strictEqual(serverResult.activateSnykIac, 'false');
    assert.strictEqual(serverResult.endpoint, clientSettings.advanced.customEndpoint);
    assert.strictEqual(serverResult.additionalParams, clientSettings.advanced.additionalParameters);
    assert.strictEqual(serverResult.sendErrorReports, `${clientSettings.yesCrashReport}`);
    assert.strictEqual(serverResult.organization, `${clientSettings.advanced.organization}`);
    assert.strictEqual(serverResult.enableTelemetry, `${clientSettings.yesTelemetry}`);
    assert.strictEqual(
      serverResult.manageBinariesAutomatically,
      `${clientSettings.advanced.automaticDependencyManagement}`,
    );
    assert.strictEqual(serverResult.cliPath, `${clientSettings.advanced.cliPath}`);
  });

  test('Configuration request should return an error', async () => {
    const middleware = new LanguageClientMiddleware();
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return new Error('test err') as ResponseError;
    };

    const token: CancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: sinon.fake(),
    };

    const res = await middleware.workspace.configuration(params, token, handler);
    if (!(res instanceof Error)) {
      console.log(res);
      assert.fail("Handler didn't return an error");
    }
  });
});
