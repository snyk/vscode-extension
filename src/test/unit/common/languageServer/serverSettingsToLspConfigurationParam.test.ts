import assert from 'assert';
import { FolderConfig } from '../../../../snyk/common/configuration/configuration';
import {
  folderConfigToLspFolderConfiguration,
  LS_KEY,
} from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

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

    const row = folderConfigToLspFolderConfiguration(fc);
    assert.strictEqual(row.folderPath, '/proj/a');
    assert.strictEqual(row.settings?.[LS_KEY.preferredOrg]?.value, 'pref');
    assert.strictEqual(row.settings?.[LS_KEY.autoDeterminedOrg]?.value, 'auto');
    assert.strictEqual(row.settings?.[LS_KEY.orgSetByUser]?.value, true);
    assert.strictEqual(row.settings?.[LS_KEY.baseBranch]?.value, 'main');
    assert.deepStrictEqual(row.settings?.[LS_KEY.localBranches]?.value, ['main', 'dev']);
    assert.strictEqual(row.settings?.[LS_KEY.referenceFolder]?.value, '/ref');
    // Extra LS settings are forwarded
    assert.strictEqual(row.settings?.['some_extra_ls_setting']?.value, 42);
  });
});
