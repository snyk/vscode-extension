import assert from 'assert';
import {
  DEFAULT_ISSUE_VIEW_OPTIONS,
  DEFAULT_RISK_SCORE_THRESHOLD,
  DEFAULT_SEVERITY_FILTER,
  FolderConfig,
  IConfiguration,
  PreviewFeatures,
} from '../../../../snyk/common/configuration/configuration';
import { LanguageServerSettings } from '../../../../snyk/common/languageServer/settings';
import { LS_KEY } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

suite('LanguageServerSettings', () => {
  suite('fromConfiguration', () => {
    test('should generate settings with default true values for undefined feature toggles', async () => {
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: 'https://dev.snyk.io/api',
        organization: 'my-org',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'snyk-token',
        getFeaturesConfiguration: () => ({ iacEnabled: true, codeSecurityEnabled: true }), // advisorEnabled is removed
        getCliPath: () => '/path/to/cli',
        getCliBaseDownloadUrl: () => 'https://downloads.snyk.io',
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
        riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        scanningMode: 'scan-mode',
        getSecureAtInceptionExecutionFrequency(): string {
          return 'Manual';
        },
        getAutoConfigureMcpServer(): boolean {
          return false;
        },
      } as unknown as IConfiguration;

      const result = await LanguageServerSettings.fromConfiguration(mockConfiguration, () => true);

      assert.strictEqual(result.settings?.[LS_KEY.snykCodeEnabled]?.value, true);
      assert.strictEqual(result.settings?.[LS_KEY.snykIacEnabled]?.value, true);
      assert.strictEqual(result.settings?.[LS_KEY.sendErrorReports]?.value, false);
      assert.strictEqual(result.settings?.[LS_KEY.cliPath]?.value, '/path/to/cli');
      assert.strictEqual(result.settings?.[LS_KEY.token]?.value, 'snyk-token');
    });

    test('uses explicit predicate for changed flag', async () => {
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: 'https://custom.example/api',
        organization: 'my-org',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'tok',
        getFeaturesConfiguration: () => ({}),
        getCliPath: () => '/cli',
        getCliBaseDownloadUrl: () => '',
        getAdditionalCliParameters: () => '',
        getTrustedFolders: () => [],
        getInsecure: () => false,
        getDeltaFindingsEnabled: () => false,
        isAutomaticDependencyManagementEnabled: () => true,
        getFolderConfigs: () => [],
        getOssQuickFixCodeActionsEnabled: () => true,
        getAuthenticationMethod: () => 'oauth',
        severityFilter: DEFAULT_SEVERITY_FILTER,
        riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        scanningMode: 'auto',
        getSecureAtInceptionExecutionFrequency: () => 'Manual',
        getAutoConfigureMcpServer: () => false,
      } as unknown as IConfiguration;

      const result = await LanguageServerSettings.fromConfiguration(mockConfiguration, () => false);
      assert.strictEqual(result.settings?.[LS_KEY.apiEndpoint]?.changed, false);

      const resultChanged = await LanguageServerSettings.fromConfiguration(mockConfiguration, () => true);
      assert.strictEqual(resultChanged.settings?.[LS_KEY.apiEndpoint]?.changed, true);
    });

    test('maps scanningMode manual to scan_automatic false', async () => {
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: '',
        organization: '',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'tok',
        getFeaturesConfiguration: () => ({}),
        getCliPath: () => '',
        getCliBaseDownloadUrl: () => '',
        getAdditionalCliParameters: () => '',
        getTrustedFolders: () => [],
        getInsecure: () => false,
        getDeltaFindingsEnabled: () => false,
        isAutomaticDependencyManagementEnabled: () => true,
        getFolderConfigs: () => [],
        getOssQuickFixCodeActionsEnabled: () => true,
        getAuthenticationMethod: () => 'oauth',
        severityFilter: DEFAULT_SEVERITY_FILTER,
        riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        scanningMode: 'manual',
        getSecureAtInceptionExecutionFrequency: () => 'Manual',
        getAutoConfigureMcpServer: () => false,
      } as unknown as IConfiguration;

      const result = await LanguageServerSettings.fromConfiguration(mockConfiguration, () => true);
      assert.strictEqual(result.settings?.[LS_KEY.scanAutomatic]?.value, false);
    });

    test('maps filterSeverity to enabled_severities object', async () => {
      const mockConfiguration: IConfiguration = {
        shouldReportErrors: false,
        snykApiEndpoint: '',
        organization: '',
        // eslint-disable-next-line @typescript-eslint/require-await
        getToken: async () => 'tok',
        getFeaturesConfiguration: () => ({}),
        getCliPath: () => '',
        getCliBaseDownloadUrl: () => '',
        getAdditionalCliParameters: () => '',
        getTrustedFolders: () => [],
        getInsecure: () => false,
        getDeltaFindingsEnabled: () => false,
        isAutomaticDependencyManagementEnabled: () => true,
        getFolderConfigs: () => [],
        getOssQuickFixCodeActionsEnabled: () => true,
        getAuthenticationMethod: () => 'oauth',
        severityFilter: { critical: true, high: false, medium: true, low: false },
        riskScoreThreshold: DEFAULT_RISK_SCORE_THRESHOLD,
        issueViewOptions: DEFAULT_ISSUE_VIEW_OPTIONS,
        scanningMode: 'auto',
        getSecureAtInceptionExecutionFrequency: () => 'Manual',
        getAutoConfigureMcpServer: () => false,
      } as unknown as IConfiguration;
    });
  });
});
