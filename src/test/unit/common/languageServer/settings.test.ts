import assert from 'assert';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { User } from '../../../../snyk/common/user';

suite('LanguageServerSettings', () => {
  suite('fromConfiguration', () => {
    test('should generate server settings with default true values for undefined feature toggles', async () => {
      const mockUser = { anonymousId: 'anonymous-id' } as User;
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: 'https://dev.snyk.io/api',
        organization: 'my-org',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'snyk-token',
        useTokenAuthentication(): boolean {
          return false;
        },
        getFeaturesConfiguration: () => ({}), // iacEnabled, codeSecurityEnabled, codeQualityEnabled are undefined
        getCliPath: () => '/path/to/cli',
        getAdditionalCliParameters: () => '--all-projects -d',
        getTrustedFolders: () => ['/trusted/path'],
        getInsecure: () => false,
        getDeltaFindingsEnabled: () => false,
        isAutomaticDependencyManagementEnabled: () => true,
        severityFilter: { critical: true, high: true, medium: true, low: false },
        scanningMode: 'scan-mode',
      } as IConfiguration;

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
