import assert from 'assert';
import sinon from 'sinon';
import { CliExecutable } from '../../../../snyk/cli/cliExecutable';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageClientMiddleware } from '../../../../snyk/common/languageServer/middleware';
import { ServerSettings } from '../../../../snyk/common/languageServer/settings';
import {
  CancellationToken,
  ConfigurationParams,
  ConfigurationRequestHandlerSignature,
  ResponseError,
} from '../../../../snyk/common/vscode/types';
import { defaultFeaturesConfigurationStub } from '../../mocks/configuration.mock';
import { extensionContextMock } from '../../mocks/extensionContext.mock';

suite('Language Server: Middleware', () => {
  let configuration: IConfiguration;
  setup(() => {
    configuration = {
      shouldReportEvents: false,
      shouldReportErrors: false,
      snykOssApiEndpoint: 'https://dev.snyk.io/api',
      getAdditionalCliParameters: () => '',
      organization: 'org',
      getToken: () => Promise.resolve('token'),
      isAutomaticDependencyManagementEnabled: () => true,
      getCliPath: () => '/path/to/cli',
      getPreviewFeatures: () => {
        return {
          advisor: false,
          reportFalsePositives: false,
        };
      },
      getFeaturesConfiguration() {
        return defaultFeaturesConfigurationStub;
      },
      severityFilter: {
        critical: true,
        high: true,
        medium: true,
        low: true,
      },
      getTrustedFolders: () => ['/trusted/test/folder'],
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('Configuration request should translate settings', async () => {
    const middleware = new LanguageClientMiddleware(configuration);
    const params: ConfigurationParams = {
      items: [
        {
          section: 'snyk',
        },
      ],
    };
    const handler: ConfigurationRequestHandlerSignature = (_params, _token) => {
      return [{}];
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
    assert.strictEqual(serverResult.activateSnykIac, 'true');
    assert.strictEqual(serverResult.endpoint, configuration.snykOssApiEndpoint);
    assert.strictEqual(serverResult.additionalParams, configuration.getAdditionalCliParameters());
    assert.strictEqual(serverResult.sendErrorReports, `${configuration.shouldReportErrors}`);
    assert.strictEqual(serverResult.organization, `${configuration.organization}`);
    assert.strictEqual(serverResult.enableTelemetry, `${configuration.shouldReportEvents}`);
    assert.strictEqual(
      serverResult.manageBinariesAutomatically,
      `${configuration.isAutomaticDependencyManagementEnabled()}`,
    );
    assert.strictEqual(
      serverResult.cliPath,
      CliExecutable.getPath(extensionContextMock.extensionPath, configuration.getCliPath()),
    );
    assert.strictEqual(serverResult.enableTrustedFoldersFeature, 'true');
    assert.deepStrictEqual(serverResult.trustedFolders, configuration.getTrustedFolders());
  });

  test('Configuration request should return an error', async () => {
    const middleware = new LanguageClientMiddleware(configuration);
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
