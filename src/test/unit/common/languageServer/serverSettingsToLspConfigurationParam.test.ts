import assert from 'assert';
import type { FolderConfig } from '../../../../snyk/common/configuration/configuration';
import {
  folderConfigToLspFolderConfiguration,
  PFLAG,
  serverSettingsToLspConfigurationParam,
} from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { ServerSettings } from '../../../../snyk/common/languageServer/settings';

function minimalServerSettings(overrides: Partial<ServerSettings> = {}): ServerSettings {
  return {
    activateSnykCodeSecurity: 'true',
    activateSnykOpenSource: 'true',
    activateSnykIac: 'true',
    activateSnykSecrets: 'true',
    enableDeltaFindings: 'false',
    sendErrorReports: 'true',
    manageBinariesAutomatically: 'true',
    enableTrustedFoldersFeature: 'true',
    insecure: 'false',
    enableSnykOSSQuickFixCodeActions: 'true',
    autoConfigureSnykMcpServer: 'false',
    endpoint: 'https://api.snyk.io',
    organization: 'org-a',
    token: 'tok',
    authenticationMethod: 'oauth',
    automaticAuthentication: 'false',
    scanningMode: 'auto',
    folderConfigs: [],
    hoverVerbosity: 1,
    ...overrides,
  };
}

suite('serverSettingsToLspConfigurationParam', () => {
  test('send_error_reports uses changed: false even when explicit predicate is true', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({ sendErrorReports: 'true' }),
      () => true,
    );
    assert.strictEqual(param.settings?.[PFLAG.sendErrorReports]?.changed, false);
  });

  test('uses explicit predicate for changed when resolveChanged does not force true or false', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: 'https://custom.example/api',
      }),
      () => false,
    );
    assert.strictEqual(param.settings?.[PFLAG.apiEndpoint]?.changed, false);
  });

  test('hover_verbosity uses changed: true regardless of explicit predicate', () => {
    const param = serverSettingsToLspConfigurationParam(minimalServerSettings({ hoverVerbosity: 2 }), () => false);
    assert.strictEqual(param.settings?.[PFLAG.hoverVerbosity]?.changed, true);
  });

  test('maps global ServerSettings to pflag keys with changed: true', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: 'https://custom.example/api',
        organization: 'my-org',
        activateSnykOpenSource: 'false',
      }),
    );

    assert.strictEqual(param.settings?.[PFLAG.apiEndpoint]?.value, 'https://custom.example/api');
    assert.strictEqual(param.settings?.[PFLAG.apiEndpoint]?.changed, true);
    assert.strictEqual(param.settings?.[PFLAG.organization]?.value, 'my-org');
    assert.strictEqual(param.settings?.[PFLAG.snykOssEnabled]?.value, false);
    assert.strictEqual(param.settings?.[PFLAG.snykOssEnabled]?.changed, true);
    assert.strictEqual(param.settings?.[PFLAG.token]?.value, 'tok');
  });

  test('maps filterSeverity to enabled_severities object', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        filterSeverity: { critical: true, high: false, medium: true, low: false },
      }),
    );
    assert.deepStrictEqual(param.settings?.[PFLAG.enabledSeverities]?.value, {
      critical: true,
      high: false,
      medium: true,
      low: false,
    });
  });

  test('scan_automatic is false when scanningMode is manual', () => {
    const param = serverSettingsToLspConfigurationParam(minimalServerSettings({ scanningMode: 'manual' }));
    assert.strictEqual(param.settings?.[PFLAG.scanAutomatic]?.value, false);
  });

  test('omits optional globals when empty', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: '',
        organization: '',
        token: '',
        additionalParams: '',
      }),
    );
    assert.strictEqual(param.settings?.[PFLAG.apiEndpoint], undefined);
    assert.strictEqual(param.settings?.[PFLAG.organization], undefined);
    assert.strictEqual(param.settings?.[PFLAG.token], undefined);
    assert.strictEqual(param.settings?.[PFLAG.additionalParameters], undefined);
  });

  test('maps folderConfigs to folderConfigs[].settings (pflag keys)', () => {
    const folderConfigs: FolderConfig[] = [
      {
        folderPath: '/proj/a',
        baseBranch: 'main',
        localBranches: ['main', 'dev'],
        referenceFolderPath: '/ref',
        orgSetByUser: true,
        preferredOrg: 'pref',
        autoDeterminedOrg: 'auto',
        orgMigratedFromGlobalConfig: false,
        scanCommandConfig: {
          oss: {
            preScanCommand: 'echo',
            preScanOnlyReferenceFolder: false,
            postScanCommand: '',
            postScanOnlyReferenceFolder: false,
          },
        },
      },
    ];

    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        folderConfigs,
      }),
    );

    assert.strictEqual(param.folderConfigs?.length, 1);
    assert.strictEqual(param.folderConfigs?.[0].folderPath, '/proj/a');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[PFLAG.preferredOrg]?.value, 'pref');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[PFLAG.autoDeterminedOrg]?.value, 'auto');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[PFLAG.orgSetByUser]?.value, true);
    assert.strictEqual(param.folderConfigs?.[0].settings?.[PFLAG.baseBranch]?.value, 'main');
    assert.deepStrictEqual(param.folderConfigs?.[0].settings?.[PFLAG.localBranches]?.value, ['main', 'dev']);
    assert.strictEqual(param.folderConfigs?.[0].settings?.[PFLAG.referenceFolder]?.value, '/ref');
  });
});

suite('folderConfigToLspFolderConfiguration', () => {
  test('exposes pflag keys with changed: true', () => {
    const fc: FolderConfig = {
      folderPath: '/w',
      baseBranch: '',
      localBranches: undefined,
      referenceFolderPath: undefined,
      orgSetByUser: false,
      preferredOrg: 'p',
      autoDeterminedOrg: '',
      orgMigratedFromGlobalConfig: false,
    };
    const row = folderConfigToLspFolderConfiguration(fc);
    assert.strictEqual(row.folderPath, '/w');
    assert.strictEqual(row.settings?.[PFLAG.preferredOrg]?.value, 'p');
    assert.strictEqual(row.settings?.[PFLAG.preferredOrg]?.changed, true);
  });
});
