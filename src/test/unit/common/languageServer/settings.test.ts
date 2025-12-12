import assert from 'assert';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
  PreviewFeatures,
} from '../../../../snyk/common/configuration/configuration';
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
        getFeaturesConfiguration: () => ({ iacEnabled: true, codeSecurityEnabled: true }), // advisorEnabled is removed
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
          return {}; // advisor is removed
        },
        getOssQuickFixCodeActionsEnabled(): boolean {
          return true;
        },
        getAuthenticationMethod(): string {
          return 'oauth';
        },
        severityFilter: DEFAULT_SEVERITY_FILTER,
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        scanningMode: 'scan-mode',
        getSecureAtInceptionExecutionFrequency(): string {
          return 'Manual';
        },
        getAutoConfigureMcpServer(): boolean {
          return false;
        },
      } as unknown as IConfiguration;

      const serverSettings = await LanguageServerSettings.fromConfiguration(mockConfiguration, mockUser);

      assert.strictEqual(serverSettings.activateSnykCodeSecurity, 'true');
      assert.strictEqual(serverSettings.activateSnykIac, 'true');
      assert.strictEqual(serverSettings.deviceId, 'anonymous-id');

      assert.strictEqual(serverSettings.sendErrorReports, 'false');
      assert.strictEqual(serverSettings.cliPath, '/path/to/cli');

      assert.strictEqual(serverSettings.token, 'snyk-token');
    });
  });
});
