import assert from 'assert';
import { mergeFolderConfigsWithInboundLspView } from '../../../../snyk/common/languageServer/inboundLspFolderSettingsToFolderConfig';
import { mergeInboundLspConfiguration } from '../../../../snyk/common/languageServer/lspConfigurationMerge';
import { PFLAG } from '../../../../snyk/common/languageServer/serverSettingsToLspConfigurationParam';
import type { FolderConfig } from '../../../../snyk/common/configuration/configuration';
import type { LspConfigurationParam } from '../../../../snyk/common/languageServer/types';

suite('mergeFolderConfigsWithInboundLspView', () => {
  test('no folder rows in view leaves existing unchanged', () => {
    const existing: FolderConfig[] = [
      {
        folderPath: '/a',
        baseBranch: 'main',
        localBranches: undefined,
        referenceFolderPath: undefined,
        orgSetByUser: false,
        preferredOrg: '',
        autoDeterminedOrg: 'org-1',
        orgMigratedFromGlobalConfig: true,
      },
    ];
    const view = mergeInboundLspConfiguration({ settings: { endpoint: { value: 'https://x', source: 'd' } } });
    const out = mergeFolderConfigsWithInboundLspView(existing, view);
    assert.deepStrictEqual(out, existing);
  });

  test('merges folder-scoped pflags from $/snyk.configuration into existing row', () => {
    const existing: FolderConfig[] = [
      {
        folderPath: '/proj',
        baseBranch: '',
        localBranches: undefined,
        referenceFolderPath: undefined,
        orgSetByUser: true,
        preferredOrg: 'keep-me',
        autoDeterminedOrg: '',
        orgMigratedFromGlobalConfig: false,
      },
    ];
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/proj',
          settings: {
            [PFLAG.baseBranch]: { value: 'develop', source: 'ls' },
            [PFLAG.localBranches]: { value: ['develop', 'main'], source: 'ls' },
          },
        },
      ],
    };
    const view = mergeInboundLspConfiguration(param);
    const out = mergeFolderConfigsWithInboundLspView(existing, view);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].folderPath, '/proj');
    assert.strictEqual(out[0].baseBranch, 'develop');
    assert.deepStrictEqual(out[0].localBranches, ['develop', 'main']);
    assert.strictEqual(out[0].preferredOrg, 'keep-me');
  });

  test('appends new folder when path only appears in inbound folderConfigs', () => {
    const existing: FolderConfig[] = [];
    const param: LspConfigurationParam = {
      folderConfigs: [
        {
          folderPath: '/new',
          settings: {
            [PFLAG.referenceFolder]: { value: '/ref', source: 'ls' },
          },
        },
      ],
    };
    const view = mergeInboundLspConfiguration(param);
    const out = mergeFolderConfigsWithInboundLspView(existing, view);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].folderPath, '/new');
    assert.strictEqual(out[0].referenceFolderPath, '/ref');
    assert.strictEqual(out[0].orgMigratedFromGlobalConfig, false);
  });
});
