import assert from 'assert';
import { FolderConfig } from '../../../../snyk/common/configuration/configuration';
import {
  folderConfigToLspFolderConfiguration,
  LS_KEY,
  serverSettingsToLspConfigurationParam,
  serverSettingsToLspInitializationOptions,
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
    assert.strictEqual(param.settings?.[LS_KEY.sendErrorReports]?.changed, false);
  });

  test('uses explicit predicate for changed when resolveChanged does not force true or false', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: 'https://custom.example/api',
      }),
      () => false,
    );
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint]?.changed, false);
  });

  test('token uses explicit predicate for changed flag', () => {
    const paramNotChanged = serverSettingsToLspConfigurationParam(minimalServerSettings({ token: 'tok' }), () => false);
    assert.strictEqual(paramNotChanged.settings?.[LS_KEY.token]?.changed, false);

    const paramChanged = serverSettingsToLspConfigurationParam(minimalServerSettings({ token: 'tok' }), () => true);
    assert.strictEqual(paramChanged.settings?.[LS_KEY.token]?.changed, true);
  });

  test('hover_verbosity uses changed: true regardless of explicit predicate', () => {
    const param = serverSettingsToLspConfigurationParam(minimalServerSettings({ hoverVerbosity: 2 }), () => false);
    assert.strictEqual(param.settings?.[LS_KEY.hoverVerbosity]?.changed, true);
  });

  test('maps global ServerSettings to LS keys with changed: true', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: 'https://custom.example/api',
        organization: 'my-org',
        activateSnykOpenSource: 'false',
      }),
    );

    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint]?.value, 'https://custom.example/api');
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint]?.changed, true);
    assert.strictEqual(param.settings?.[LS_KEY.organization]?.value, 'my-org');
    assert.strictEqual(param.settings?.[LS_KEY.snykOssEnabled]?.value, false);
    assert.strictEqual(param.settings?.[LS_KEY.snykOssEnabled]?.changed, true);
    assert.strictEqual(param.settings?.[LS_KEY.token]?.value, 'tok');
  });

  test('maps filterSeverity to enabled_severities object', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        filterSeverity: { critical: true, high: false, medium: true, low: false },
      }),
    );
    assert.deepStrictEqual(param.settings?.[LS_KEY.enabledSeverities]?.value, {
      critical: true,
      high: false,
      medium: true,
      low: false,
    });
  });

  test('scan_automatic is false when scanningMode is manual', () => {
    const param = serverSettingsToLspConfigurationParam(minimalServerSettings({ scanningMode: 'manual' }));
    assert.strictEqual(param.settings?.[LS_KEY.scanAutomatic]?.value, false);
  });

  test('forwards empty string settings when explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: '',
        organization: '',
        token: '',
        additionalParams: '',
      }),
      () => true,
    );
    assert.deepStrictEqual(param.settings?.[LS_KEY.apiEndpoint], { value: '', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.token], { value: '', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.additionalParameters], { value: '', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.organization], { value: '', changed: true });
  });

  test('omits empty string settings when not explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: '',
        organization: '',
      }),
      () => false,
    );
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint], undefined);
    assert.strictEqual(param.settings?.[LS_KEY.organization], undefined);
  });

  test('sends reset (value: null, changed: true) only for explicit null when explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        organization: null as unknown as string,
        endpoint: null as unknown as string,
      }),
      () => true,
    );
    assert.deepStrictEqual(param.settings?.[LS_KEY.organization], { value: null, changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.apiEndpoint], { value: null, changed: true });
  });

  test('omits undefined settings even when explicitly changed (undefined means no value)', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        organization: undefined,
        endpoint: undefined,
      }),
      () => true,
    );
    assert.strictEqual(param.settings?.[LS_KEY.organization], undefined);
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint], undefined);
  });

  test('omits null settings when not explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        organization: null as unknown as string,
        endpoint: null as unknown as string,
      }),
      () => false,
    );
    assert.strictEqual(param.settings?.[LS_KEY.organization], undefined);
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint], undefined);
  });

  test('forwards whitespace-only strings when explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: '  ',
        cliBaseDownloadURL: '\t',
        cliPath: '',
        token: '   ',
      }),
      () => true,
    );
    assert.deepStrictEqual(param.settings?.[LS_KEY.apiEndpoint], { value: '  ', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.binaryBaseUrl], { value: '\t', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.cliPath], { value: '', changed: true });
    assert.deepStrictEqual(param.settings?.[LS_KEY.token], { value: '   ', changed: true });
  });

  test('omits whitespace-only strings when not explicitly changed', () => {
    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        endpoint: '  ',
        cliBaseDownloadURL: '\t',
      }),
      () => false,
    );
    assert.strictEqual(param.settings?.[LS_KEY.apiEndpoint], undefined);
    assert.strictEqual(param.settings?.[LS_KEY.binaryBaseUrl], undefined);
  });

  test('risk_score_threshold only when != null; 0 is sent', () => {
    assert.strictEqual(
      serverSettingsToLspConfigurationParam(minimalServerSettings({ riskScoreThreshold: undefined })).settings?.[
        LS_KEY.riskScoreThreshold
      ],
      undefined,
    );
    assert.strictEqual(
      serverSettingsToLspConfigurationParam({
        ...minimalServerSettings(),
        riskScoreThreshold: null,
      } as unknown as ServerSettings).settings?.[LS_KEY.riskScoreThreshold],
      undefined,
    );
    const withZero = serverSettingsToLspConfigurationParam(minimalServerSettings({ riskScoreThreshold: 0 }));
    assert.strictEqual(withZero.settings?.[LS_KEY.riskScoreThreshold]?.value, 0);
    const withFive = serverSettingsToLspConfigurationParam(minimalServerSettings({ riskScoreThreshold: 5 }));
    assert.strictEqual(withFive.settings?.[LS_KEY.riskScoreThreshold]?.value, 5);
  });

  test('maps folderConfigs to folderConfigs[].settings (LS keys)', () => {
    const fc = new FolderConfig('/proj/a', {
      [LS_KEY.baseBranch]: { value: 'main', changed: true },
      [LS_KEY.localBranches]: { value: ['main', 'dev'], changed: true },
      [LS_KEY.referenceFolder]: { value: '/ref', changed: true },
      [LS_KEY.orgSetByUser]: { value: true, changed: true },
      [LS_KEY.preferredOrg]: { value: 'pref', changed: true },
      [LS_KEY.autoDeterminedOrg]: { value: 'auto', changed: true },
      [LS_KEY.scanCommandConfig]: {
        value: {
          oss: {
            preScanCommand: 'echo',
            preScanOnlyReferenceFolder: false,
            postScanCommand: '',
            postScanOnlyReferenceFolder: false,
          },
        },
        changed: true,
      },
      some_extra_ls_setting: { value: 42, changed: true },
    });

    const param = serverSettingsToLspConfigurationParam(
      minimalServerSettings({
        folderConfigs: [fc],
      }),
    );

    assert.strictEqual(param.folderConfigs?.length, 1);
    assert.strictEqual(param.folderConfigs?.[0].folderPath, '/proj/a');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.preferredOrg]?.value, 'pref');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.autoDeterminedOrg]?.value, 'auto');
    assert.strictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.orgSetByUser]?.value, true);
    assert.strictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.baseBranch]?.value, 'main');
    assert.deepStrictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.localBranches]?.value, ['main', 'dev']);
    assert.strictEqual(param.folderConfigs?.[0].settings?.[LS_KEY.referenceFolder]?.value, '/ref');
    // Extra LS settings are forwarded
    assert.strictEqual(param.folderConfigs?.[0].settings?.['some_extra_ls_setting']?.value, 42);
  });
});

suite('folderConfigToLspFolderConfiguration', () => {
  test('exposes LS keys with changed: true', () => {
    const fc = new FolderConfig('/w', {
      [LS_KEY.preferredOrg]: { value: 'p', changed: true },
    });
    const row = folderConfigToLspFolderConfiguration(fc);
    assert.strictEqual(row.folderPath, '/w');
    assert.strictEqual(row.settings?.[LS_KEY.preferredOrg]?.value, 'p');
    assert.strictEqual(row.settings?.[LS_KEY.preferredOrg]?.changed, true);
  });
});

suite('serverSettingsToLspInitializationOptions', () => {
  test('includes LS settings map and init metadata from flat ServerSettings', () => {
    const flat = minimalServerSettings({
      requiredProtocolVersion: '25',
      deviceId: 'device-1',
      integrationName: 'VS_CODE',
      integrationVersion: '1.2.3',
      osPlatform: 'darwin',
      osArch: 'arm64',
      runtimeVersion: '20',
      runtimeName: 'node',
      path: '/workspace',
      trustedFolders: ['/a'],
    });
    const init = serverSettingsToLspInitializationOptions(flat, () => true);
    assert.strictEqual(init.requiredProtocolVersion, '25');
    assert.strictEqual(init.deviceId, 'device-1');
    assert.strictEqual(init.integrationName, 'VS_CODE');
    assert.strictEqual(init.integrationVersion, '1.2.3');
    assert.strictEqual(init.osPlatform, 'darwin');
    assert.strictEqual(init.osArch, 'arm64');
    assert.strictEqual(init.runtimeVersion, '20');
    assert.strictEqual(init.runtimeName, 'node');
    assert.strictEqual(init.path, '/workspace');
    assert.deepStrictEqual(init.trustedFolders, ['/a']);
    assert.strictEqual(init.settings[LS_KEY.token]?.value, 'tok');
  });

  test('respects explicit change predicate for changed flags', () => {
    const flat = minimalServerSettings({
      insecure: 'true',
    });
    const init = serverSettingsToLspInitializationOptions(flat, lsKey => lsKey === LS_KEY.cliInsecure);

    assert.strictEqual(init.settings[LS_KEY.cliInsecure]?.value, true);
    assert.strictEqual(init.settings[LS_KEY.cliInsecure]?.changed, true);

    assert.strictEqual(init.settings[LS_KEY.snykCodeEnabled]?.value, true);
    assert.strictEqual(init.settings[LS_KEY.snykCodeEnabled]?.changed, false);
  });
});
