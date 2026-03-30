/**
 * Map keys and ConfigSetting shapes follow snyk-ls PR #1162 (IDE-1786):
 * `internal/types/lsp.go` — `settings` / `folderConfigs[].settings` use pflag / Settings JSON names
 * (`endpoint`, `organization`, `activateSnykCode`, …).
 */
import assert from 'assert';
import { effectiveGlobalSettingsForIdePersistence } from '../../../../snyk/common/languageServer/inboundLspConfigurationToIdeConfig';
import { mergeInboundLspConfiguration } from '../../../../snyk/common/languageServer/lspConfigurationMerge';
import { LspConfigurationParam } from '../../../../snyk/common/languageServer/types';
import { PFLAG } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';

suite('mergeInboundLspConfiguration', () => {
  test('empty payload yields empty global and no folders', () => {
    const merged = mergeInboundLspConfiguration({});
    assert.deepStrictEqual(merged.globalSettings, {});
    assert.deepStrictEqual(merged.folderSettingsByPath, {});
  });

  test('only global settings', () => {
    const param: LspConfigurationParam = {
      settings: {
        endpoint: { value: 'https://api.snyk.io', source: 'default', isLocked: false },
      },
    };
    const merged = mergeInboundLspConfiguration(param);
    assert.deepStrictEqual(merged.globalSettings, param.settings);
    assert.deepStrictEqual(merged.folderSettingsByPath, {});
  });

  test('only folderConfigs: effective folder map includes only folder keys when global empty', () => {
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/workspace/a',
          settings: {
            activateSnykCode: { value: true, source: 'user-override', isLocked: false },
          },
        },
      ],
    };
    const merged = mergeInboundLspConfiguration(param);
    assert.deepStrictEqual(merged.globalSettings, {});
    assert.deepStrictEqual(merged.folderSettingsByPath['/workspace/a'], {
      activateSnykCode: { value: true, source: 'user-override', isLocked: false },
    });
  });

  test('global and folder: folder keys override global for same key', () => {
    const param: LspConfigurationParam = {
      settings: {
        activateSnykCode: { value: false, source: 'default', isLocked: false },
        endpoint: { value: 'https://api.snyk.io', source: 'default', isLocked: false },
      },
      folderConfigs: [
        {
          folderPath: '/workspace/b',
          settings: {
            activateSnykCode: {
              value: true,
              source: 'ldx-sync-locked',
              originScope: 'tenant',
              isLocked: true,
            },
          },
        },
      ],
    };
    const merged = mergeInboundLspConfiguration(param);
    assert.deepStrictEqual(merged.globalSettings, param.settings);
    const effective = merged.folderSettingsByPath['/workspace/b'];
    assert.strictEqual(effective?.activateSnykCode?.value, true);
    assert.strictEqual(effective?.activateSnykCode?.isLocked, true);
    assert.deepStrictEqual(effective?.endpoint, param.settings?.endpoint);
  });

  test('multiple folders with distinct paths', () => {
    const param: LspConfigurationParam = {
      settings: {
        organization: { value: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'ldx-sync', isLocked: false },
      },
      folderConfigs: [
        {
          folderPath: '/a',
          settings: { activateSnykOpenSource: { value: true, source: 'user-override', isLocked: false } },
        },
        {
          folderPath: '/b',
          settings: { activateSnykIac: { value: false, source: 'default', isLocked: false } },
        },
      ],
    };
    const merged = mergeInboundLspConfiguration(param);
    assert.deepStrictEqual(merged.folderSettingsByPath['/a'], {
      organization: { value: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'ldx-sync', isLocked: false },
      activateSnykOpenSource: { value: true, source: 'user-override', isLocked: false },
    });
    assert.deepStrictEqual(merged.folderSettingsByPath['/b'], {
      organization: { value: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'ldx-sync', isLocked: false },
      activateSnykIac: { value: false, source: 'default', isLocked: false },
    });
  });

  test('duplicate folderPath: last folderConfigs entry wins', () => {
    const param: LspConfigurationParam = {
      settings: { endpoint: { value: 'https://api.snyk.io', source: 'default', isLocked: false } },
      folderConfigs: [
        { folderPath: '/same', settings: { activateSnykCode: { value: false, source: 'default' } } },
        { folderPath: '/same', settings: { activateSnykCode: { value: true, source: 'user-override' } } },
      ],
    };
    const merged = mergeInboundLspConfiguration(param);
    assert.strictEqual(merged.folderSettingsByPath['/same']?.activateSnykCode?.value, true);
    assert.strictEqual(merged.folderSettingsByPath['/same']?.activateSnykCode?.source, 'user-override');
  });
});

suite('effectiveGlobalSettingsForIdePersistence', () => {
  test('no workspace folders: use global settings only', () => {
    const view = mergeInboundLspConfiguration({
      settings: { endpoint: { value: 'https://a', source: 'default', isLocked: false } },
    });
    const eff = effectiveGlobalSettingsForIdePersistence(view, []);
    assert.deepStrictEqual(eff, view.globalSettings);
  });

  test('first workspace folder has merged row: use it (folder-only scan_net_new)', () => {
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/workspace/proj',
          settings: {
            [PFLAG.scanNetNew]: { value: true, source: 'ldx-sync', isLocked: false },
          },
        },
      ],
    };
    const view = mergeInboundLspConfiguration(param);
    const eff = effectiveGlobalSettingsForIdePersistence(view, ['/workspace/proj']);
    assert.strictEqual(eff[PFLAG.scanNetNew]?.value, true);
  });

  test('folder path mismatch: fall back to global', () => {
    const param: LspConfigurationParam = {
      settings: {
        endpoint: { value: 'https://global', source: 'default', isLocked: false },
      },
      folderConfigs: [{ folderPath: '/other', settings: {} }],
    };
    const view = mergeInboundLspConfiguration(param);
    const eff = effectiveGlobalSettingsForIdePersistence(view, ['/workspace/proj']);
    assert.strictEqual(eff.endpoint?.value, 'https://global');
  });
});
