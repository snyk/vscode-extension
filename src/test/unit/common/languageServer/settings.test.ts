import assert from 'assert';
import { FolderConfig, IConfiguration, PreviewFeatures } from '../../../../snyk/common/configuration/configuration';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { User } from '../../../../snyk/common/user';
import sinon from 'sinon';
import { ExtensionContext } from '../../../../snyk/common/vscode/extensionContext';

suite('LanguageServerSettings', () => {
  suite('fromConfiguration', () => {
    test('should generate server settings with default true values for undefined feature toggles', async () => {
      const mockUser = { anonymousId: 'anonymous-id' } as User;
      const extensionContextMock: ExtensionContext = {
        extensionPath: 'test/path',
        updateGlobalStateValue: sinon.fake(),
        setContext: sinon.fake(),
        subscriptions: [],
        addDisposables: sinon.fake(),
        getExtensionUri: sinon.fake(),
      } as unknown as ExtensionContext;
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: 'https://dev.snyk.io/api',
        organization: 'my-org',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'snyk-token',
        getFeaturesConfiguration: () => ({}), // iacEnabled, codeSecurityEnabled, codeQualityEnabled are undefined
        getCliPath: () => '/path/to/cli',
        getAdditionalCliParameters: () => '--all-projects -d',
        getTrustedFolders: () => ['/trusted/path'],
        getInsecure: () => false,
        getDeltaFindingsEnabled: () => false,
        isAutomaticDependencyManagementEnabled: () => true,
        getFolderConfigs(): FolderConfig[] {
          return [];
        },
        getPreviewFeatures(): PreviewFeatures {
          return { advisor: false, ossQuickfixes: false };
        },
        getOssQuickFixCodeActionsEnabled(): boolean {
          return false;
        },
        getAuthenticationMethod(): string {
          return 'oauth';
        },
        severityFilter: { critical: true, high: true, medium: true, low: false },
        scanningMode: 'scan-mode',
      } as unknown as IConfiguration;

      const serverSettings = await LanguageServerSettings.fromConfiguration(mockConfiguration, mockUser);

      assert.strictEqual(serverSettings.activateSnykCodeSecurity, 'true');
      assert.strictEqual(serverSettings.activateSnykCodeQuality, 'true');
      assert.strictEqual(serverSettings.activateSnykIac, 'true');
      assert.strictEqual(serverSettings.deviceId, 'anonymous-id');

      assert.strictEqual(serverSettings.sendErrorReports, 'false');
      assert.strictEqual(serverSettings.cliPath, '/path/to/cli');

      assert.strictEqual(serverSettings.token, 'snyk-token');
    });
  });
});
